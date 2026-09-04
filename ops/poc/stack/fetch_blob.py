import base64
import codecs
import gzip
import hashlib
import json
import sys
from dataclasses import dataclass


BUCKET = "softwareheritage"
KEY_PREFIX = "content/"
MAXIMUM_ATTEMPTS = 50
MAXIMUM_BLOB_BYTES = 256 * 1024
MAXIMUM_TOTAL_BYTES = 16 * 1024 * 1024
MAXIMUM_TEMPORARY_BYTES = 32 * 1024 * 1024
MAXIMUM_REQUEST_BYTES = 64 * 1024
READ_BYTES = 64 * 1024
ROW_KEYS = {
    "stableRowId", "swhBlobId", "swhContentId", "sourceEncoding", "byteLength",
}
LIMIT_KEYS = {
    "blobAttempts", "successfulBlobs", "perBlobBytes", "totalBlobBytes",
    "temporaryDiskBytes",
}


@dataclass(frozen=True)
class BlobLimits:
    attempts: int
    successes: int
    per_blob_bytes: int
    total_blob_bytes: int
    temporary_disk_bytes: int


SIGNED_LIMITS = BlobLimits(
    MAXIMUM_ATTEMPTS, MAXIMUM_ATTEMPTS, MAXIMUM_BLOB_BYTES,
    MAXIMUM_TOTAL_BYTES, MAXIMUM_TEMPORARY_BYTES,
)


class BlobFetchError(Exception):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def _fail(code):
    raise BlobFetchError(code)


def _hex(value, length):
    if not isinstance(value, str) or len(value) != length:
        _fail("ROW_IDENTITY_REJECTED")
    if any(character not in "0123456789abcdef" for character in value):
        _fail("ROW_IDENTITY_REJECTED")
    return value


def _parse_limits(value):
    if value is None:
        return SIGNED_LIMITS
    if not isinstance(value, dict) or set(value) != LIMIT_KEYS:
        _fail("LIMIT_SHAPE")
    maxima = {
        "blobAttempts": MAXIMUM_ATTEMPTS,
        "successfulBlobs": MAXIMUM_ATTEMPTS,
        "perBlobBytes": MAXIMUM_BLOB_BYTES,
        "totalBlobBytes": MAXIMUM_TOTAL_BYTES,
        "temporaryDiskBytes": MAXIMUM_TEMPORARY_BYTES,
    }
    for key, maximum in maxima.items():
        if isinstance(value[key], bool) or not isinstance(value[key], int) or value[key] < 1:
            _fail("LIMIT_VALUE")
        if value[key] > maximum:
            _fail("LIMIT_RAISED")
    return BlobLimits(
        value["blobAttempts"], value["successfulBlobs"], value["perBlobBytes"],
        value["totalBlobBytes"], value["temporaryDiskBytes"],
    )


def _validate_rows(rows, limits):
    if not isinstance(rows, list) or not rows or len(rows) > limits.attempts:
        _fail("BLOB_ATTEMPTS")
    if len(rows) > limits.successes:
        _fail("SUCCESSFUL_BLOBS")
    parsed = []
    for row in rows:
        if not isinstance(row, dict) or set(row) != ROW_KEYS:
            _fail("ROW_SHAPE_REJECTED")
        size = row["byteLength"]
        if row["sourceEncoding"] != "UTF-8":
            _fail("ENCODING_REJECTED")
        if isinstance(size, bool) or not isinstance(size, int) or not 1 <= size <= limits.per_blob_bytes:
            _fail("DECLARED_SIZE_REJECTED")
        parsed.append({
            "stableRowId": _hex(row["stableRowId"], 64),
            "swhBlobId": _hex(row["swhBlobId"], 40),
            "swhContentId": _hex(row["swhContentId"], 40),
            "sourceEncoding": "UTF-8",
            "byteLength": size,
        })
    for key in ("stableRowId", "swhBlobId", "swhContentId"):
        identities = [row[key] for row in parsed]
        if len(set(identities)) != len(identities):
            _fail("ROW_DUPLICATE")
    if sum(row["byteLength"] for row in parsed) > limits.total_blob_bytes:
        _fail("TOTAL_BLOB_BYTES")
    return parsed


def _default_session():
    import boto3
    return boto3.Session()


def _response_body(client, row):
    try:
        response = client.get_object(
            Bucket=BUCKET, Key=KEY_PREFIX + row["swhBlobId"],
        )
    except Exception:
        _fail("BLOB_UNAVAILABLE")
    if not isinstance(response, dict):
        _fail("BLOB_UNAVAILABLE")
    body = response.get("Body")
    metadata = response.get("ResponseMetadata")
    headers = metadata.get("HTTPHeaders") if isinstance(metadata, dict) else None
    if response.get("WebsiteRedirectLocation") is not None:
        _close(body)
        _fail("REDIRECT_REJECTED")
    if isinstance(headers, dict) and any(key.lower() == "location" for key in headers):
        _close(body)
        _fail("REDIRECT_REJECTED")
    if not isinstance(metadata, dict) or metadata.get("HTTPStatusCode") != 200:
        _close(body)
        _fail("BLOB_UNAVAILABLE")
    if not callable(getattr(body, "read", None)) or not callable(getattr(body, "close", None)):
        _fail("BLOB_UNAVAILABLE")
    return body


def _close(body):
    close = getattr(body, "close", None)
    if callable(close):
        try:
            close()
        except Exception:
            pass


def _decompress(body, remaining, per_blob_bytes):
    content = bytearray()
    ceiling = min(per_blob_bytes, remaining)
    try:
        with gzip.GzipFile(fileobj=body, mode="rb") as stream:
            while True:
                chunk = stream.read(min(READ_BYTES, ceiling - len(content) + 1))
                if not chunk:
                    return content
                content.extend(chunk)
                if len(content) > ceiling:
                    _fail("BLOB_BYTES" if ceiling == per_blob_bytes else "TOTAL_BLOB_BYTES")
    except BlobFetchError:
        content[:] = b"\0" * len(content)
        raise
    except Exception:
        content[:] = b"\0" * len(content)
        _fail("DECOMPRESSION_FAILED")


def _validate_content(row, content):
    try:
        decoder = codecs.getincrementaldecoder("utf-8")("strict")
        for offset in range(0, len(content), READ_BYTES):
            decoder.decode(memoryview(content)[offset:offset + READ_BYTES], final=False)
        decoder.decode(b"", final=True)
    except UnicodeDecodeError:
        _fail("DECODING_FAILED")
    if len(content) != row["byteLength"]:
        _fail("SIZE_MISMATCH")
    if hashlib.sha1(content).hexdigest() != row["swhBlobId"]:
        _fail("BLOB_ID_MISMATCH")
    header = f"blob {len(content)}\0".encode("ascii")
    digest = hashlib.sha1()
    digest.update(header)
    digest.update(content)
    if digest.hexdigest() != row["swhContentId"]:
        _fail("CONTENT_ID_MISMATCH")


def fetch_selected_blobs(rows, *, limits=None, session_factory=None):
    bounded = _parse_limits(limits)
    selected = _validate_rows(rows, bounded)
    factory = _default_session if session_factory is None else session_factory
    try:
        client = factory().client("s3")
    except Exception:
        _fail("BLOB_UNAVAILABLE")
    results = []
    total = 0
    for row in selected:
        body = _response_body(client, row)
        content = None
        try:
            content = _decompress(body, bounded.total_blob_bytes - total, bounded.per_blob_bytes)
            _validate_content(row, content)
            total += len(content)
            results.append({
                "stableRowId": row["stableRowId"],
                "swhBlobId": row["swhBlobId"],
                "contentBase64": base64.b64encode(content).decode("ascii"),
                "byteLength": len(content),
            })
        finally:
            if content is not None:
                content[:] = b"\0" * len(content)
            _close(body)
    return tuple(results)


def _read_request(stream):
    raw = stream.read(MAXIMUM_REQUEST_BYTES + 1)
    if not isinstance(raw, bytes) or len(raw) > MAXIMUM_REQUEST_BYTES:
        _fail("REQUEST_BYTES")
    try:
        return json.loads(raw.decode("utf-8", errors="strict"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        _fail("REQUEST_MALFORMED")


def _main(*, stdin=None, stdout=None, stderr=None, session_factory=None):
    active_input = sys.stdin.buffer if stdin is None else stdin
    active_output = sys.stdout if stdout is None else stdout
    active_error = sys.stderr if stderr is None else stderr
    try:
        request = _read_request(active_input)
        if not isinstance(request, dict) or set(request) != {"rows", "limits"}:
            _fail("REQUEST_MALFORMED")
        results = fetch_selected_blobs(
            request["rows"], limits=request["limits"], session_factory=session_factory,
        )
        for result in results:
            active_output.write(json.dumps(result, separators=(",", ":")) + "\n")
        return 0
    except BlobFetchError as error:
        active_error.write(error.code + "\n")
        return 1
    except Exception:
        active_error.write("REQUEST_MALFORMED\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(_main())
