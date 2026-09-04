import datetime
import hashlib
import json
import os
import re
import sys
import tempfile


DATASET_NAME = "bigcode/the-stack-v2"
PINNED_REVISION = "e565caa3a78c2423bd374333a472b049eb090e47"
MAXIMUM_ROWS = 10_000
MAXIMUM_BLOB_BYTES = 256 * 1024
REQUEST_KEYS = {"configuration", "revision", "rowLimit", "perBlobByteLimit"}
PROVIDER_KEYS = {
    "blob_id", "directory_id", "path", "content_id", "detected_licenses",
    "license_type", "repo_name", "snapshot_id", "revision_id", "branch_name",
    "visit_date", "revision_date", "committer_date", "github_id",
    "star_events_count", "fork_events_count", "gha_license_id",
    "gha_event_created_at", "gha_created_at", "gha_language", "src_encoding",
    "language", "is_vendor", "is_generated", "length_bytes", "extension",
    "filename",
}
CACHE_KEYS = ("HF_HOME", "HF_DATASETS_CACHE", "HUGGINGFACE_HUB_CACHE")
HEX_40 = re.compile(r"^[0-9a-f]{40}$")
REPOSITORY = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


class MetadataStreamError(Exception):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def _fail(code):
    raise MetadataStreamError(code)


def _parse_request(value, environment):
    if not isinstance(value, dict) or set(value) != REQUEST_KEYS:
        _fail("REQUEST_MALFORMED")
    configuration = value["configuration"]
    if configuration not in ("Python", "TypeScript"):
        _fail("CONFIGURATION_REJECTED")
    if value["revision"] != PINNED_REVISION:
        _fail("REVISION_REJECTED")
    row_limit = _bounded_integer(value["rowLimit"], MAXIMUM_ROWS, "ROW_LIMIT_REJECTED")
    byte_limit = _bounded_integer(
        value["perBlobByteLimit"], MAXIMUM_BLOB_BYTES, "BYTE_LIMIT_REJECTED"
    )
    token = environment.get("HF_TOKEN")
    if not isinstance(token, str) or not token.strip():
        _fail("TOKEN_MISSING")
    return configuration, row_limit, byte_limit, token


def _bounded_integer(value, maximum, code):
    if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= maximum:
        _fail(code)
    return value


def _text(value, code):
    if not isinstance(value, str) or not value or value.strip() != value:
        _fail(code)
    return value


def _identifier(value):
    parsed = _text(value, "IDENTIFIER_REJECTED")
    if not HEX_40.fullmatch(parsed):
        _fail("IDENTIFIER_REJECTED")
    return parsed


def _date(value, *, optional=False):
    if value is None and optional:
        return None
    if isinstance(value, datetime.datetime):
        moment = value
    elif isinstance(value, str) and value.strip() == value and value:
        try:
            moment = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            _fail("DATE_REJECTED")
    else:
        _fail("DATE_REJECTED")
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=datetime.timezone.utc)
    moment = moment.astimezone(datetime.timezone.utc)
    timespec = "microseconds" if moment.microsecond else "seconds"
    return moment.isoformat(timespec=timespec).replace("+00:00", "Z")


def _path(value, configuration):
    parsed = _text(value, "PATH_REJECTED")
    relative = parsed[1:] if parsed.startswith("/") else parsed
    extensions = (".py",) if configuration == "Python" else (".ts", ".tsx")
    if not parsed.startswith("/") or "\\" in parsed:
        _fail("PATH_REJECTED")
    if any(part in ("", ".", "..") for part in relative.split("/")):
        _fail("PATH_REJECTED")
    if not relative.endswith(extensions):
        _fail("PATH_REJECTED")
    return relative


def _licenses(value):
    if not isinstance(value, list) or not value:
        _fail("LICENSE_REJECTED")
    parsed = [_text(item, "LICENSE_REJECTED") for item in value]
    if len(set(parsed)) != len(parsed):
        _fail("LICENSE_REJECTED")
    return parsed


def _validate_documented_columns(value, path):
    if value["license_type"] not in ("permissive", "no_license"):
        _fail("ROW_VALUE_REJECTED")
    if not _text(value["branch_name"], "ROW_VALUE_REJECTED").startswith("refs/"):
        _fail("ROW_VALUE_REJECTED")
    for name in ("github_id", "star_events_count", "fork_events_count"):
        if isinstance(value[name], bool) or not isinstance(value[name], int) or value[name] < 0:
            _fail("ROW_VALUE_REJECTED")
    for name in ("gha_license_id", "gha_language"):
        if value[name] is not None:
            _text(value[name], "ROW_VALUE_REJECTED")
    _date(value["gha_event_created_at"], optional=True)
    _date(value["gha_created_at"], optional=True)
    extension = _text(value["extension"], "ROW_VALUE_REJECTED")
    filename = _text(value["filename"], "ROW_VALUE_REJECTED")
    if extension != path.rsplit(".", 1)[-1] or filename != path.rsplit("/", 1)[-1]:
        _fail("ROW_VALUE_REJECTED")


def _validate_row(value, configuration, byte_limit):
    if not isinstance(value, dict) or set(value) != PROVIDER_KEYS:
        _fail("ROW_SCHEMA_REJECTED")
    if value["language"] != configuration:
        _fail("LANGUAGE_REJECTED")
    if value["is_generated"] is not False:
        _fail("GENERATED_REJECTED")
    if value["is_vendor"] is not False:
        _fail("VENDOR_REJECTED")
    if value["src_encoding"] != "UTF-8":
        _fail("ENCODING_REJECTED")
    length = _bounded_integer(value["length_bytes"], byte_limit, "LENGTH_REJECTED")
    repository = _text(value["repo_name"], "REPOSITORY_REJECTED")
    if not REPOSITORY.fullmatch(repository):
        _fail("REPOSITORY_REJECTED")
    path = _path(value["path"], configuration)
    _validate_documented_columns(value, path)
    return _project(value, configuration, repository, path, length)


def _project(value, configuration, repository, path, length):
    fields = {
        "swhBlobId": _identifier(value["blob_id"]),
        "swhContentId": _identifier(value["content_id"]),
        "swhDirectoryId": _identifier(value["directory_id"]),
        "swhSnapshotId": _identifier(value["snapshot_id"]),
        "swhRevisionId": _identifier(value["revision_id"]),
        "repository": repository,
        "path": path,
        "detectedLicenses": _licenses(value["detected_licenses"]),
        "detectedLanguage": configuration,
        "generated": False,
        "vendor": False,
        "sourceEncoding": "UTF-8",
        "byteLength": length,
        "visitDate": _date(value["visit_date"]),
        "revisionDate": _date(value["revision_date"]),
        "committerDate": _date(value["committer_date"]),
    }
    canonical = json.dumps(fields, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return {"stableRowId": hashlib.sha256(canonical.encode("utf-8")).hexdigest(), **fields}


def _cache_environment(environment, root):
    previous = {key: environment.get(key) for key in CACHE_KEYS}
    for key, directory in (("HF_HOME", "home"), ("HF_DATASETS_CACHE", "datasets"),
                           ("HUGGINGFACE_HUB_CACHE", "hub")):
        path = os.path.join(root, directory)
        os.makedirs(path, mode=0o700)
        environment[key] = path
    return previous


def _restore_environment(environment, previous):
    for key, value in previous.items():
        if value is None:
            environment.pop(key, None)
        else:
            environment[key] = value


def _default_loader(*args, **kwargs):
    from datasets import load_dataset
    return load_dataset(*args, **kwargs)


def stream_metadata(request, *, load_dataset_fn=None, environment=None, output=None):
    active_environment = os.environ if environment is None else environment
    active_output = sys.stdout if output is None else output
    configuration, row_limit, byte_limit, token = _parse_request(request, active_environment)
    loader = _default_loader if load_dataset_fn is None else load_dataset_fn
    with tempfile.TemporaryDirectory(prefix="codeguessr-stack-metadata-") as cache_root:
        previous = _cache_environment(active_environment, cache_root)
        try:
            try:
                dataset = loader(
                    DATASET_NAME, configuration, split="train", streaming=True,
                    revision=PINNED_REVISION, token=token,
                )
            except Exception:
                _fail("DATASET_LOAD_FAILED")
            iterator = iter(dataset)
            for _index in range(row_limit):
                try:
                    source_row = next(iterator)
                except StopIteration:
                    _fail("EARLY_STOP")
                except Exception:
                    _fail("STREAM_FAILED")
                projected = _validate_row(source_row, configuration, byte_limit)
                active_output.write(json.dumps(projected, ensure_ascii=False, separators=(",", ":")) + "\n")
            return row_limit
        finally:
            _restore_environment(active_environment, previous)


def _main():
    try:
        stream_metadata(json.load(sys.stdin))
        return 0
    except MetadataStreamError as error:
        sys.stderr.write(error.code + "\n")
        return 1
    except Exception:
        sys.stderr.write("REQUEST_MALFORMED\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(_main())
