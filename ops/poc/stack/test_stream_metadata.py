import datetime
import io
import json
import os
import unittest

from stream_metadata import MetadataStreamError, stream_metadata


REVISION = "e565caa3a78c2423bd374333a472b049eb090e47"


def row(**overrides):
    value = {
        "blob_id": "a" * 40,
        "directory_id": "b" * 40,
        "path": "/src/example.py",
        "content_id": "c" * 40,
        "detected_licenses": ["MIT"],
        "license_type": "permissive",
        "repo_name": "example/project",
        "snapshot_id": "d" * 40,
        "revision_id": "e" * 40,
        "branch_name": "refs/heads/main",
        "visit_date": datetime.datetime(2023, 9, 6, 10, 44, 38, 631000),
        "revision_date": "2023-09-05T09:30:00",
        "committer_date": datetime.datetime(
            2023, 9, 5, 11, 30, tzinfo=datetime.timezone(datetime.timedelta(hours=2))
        ),
        "github_id": 123,
        "star_events_count": 4,
        "fork_events_count": 2,
        "gha_license_id": "MIT",
        "gha_event_created_at": None,
        "gha_created_at": None,
        "gha_language": "Python",
        "src_encoding": "UTF-8",
        "language": "Python",
        "is_vendor": False,
        "is_generated": False,
        "length_bytes": 128,
        "extension": "py",
        "filename": "example.py",
    }
    value.update(overrides)
    return value


def request(**overrides):
    value = {
        "configuration": "Python",
        "revision": REVISION,
        "rowLimit": 1,
        "perBlobByteLimit": 262_144,
    }
    value.update(overrides)
    return value


class StreamMetadataTests(unittest.TestCase):
    def run_stream(self, rows, request_value=None, token="external-token"):
        calls = []
        output = io.StringIO()
        environment = {"HF_TOKEN": token}

        def loader(*args, **kwargs):
            calls.append((args, kwargs, environment.copy()))
            return iter(rows)

        count = stream_metadata(
            request_value or request(), load_dataset_fn=loader,
            environment=environment, output=output,
        )
        return count, calls, output.getvalue(), environment

    def assert_code(self, code, callback):
        with self.assertRaises(MetadataStreamError) as caught:
            callback()
        self.assertEqual(caught.exception.code, code)
        self.assertEqual(str(caught.exception), code)

    def test_calls_only_revision_pinned_streaming_dataset_for_allowed_configurations(self):
        for configuration, path, extension in [
            ("Python", "/x.py", "py"),
            ("TypeScript", "/x.ts", "ts"),
        ]:
            record = row(
                language=configuration, path=path, extension=extension,
                filename=path[1:], gha_language=configuration,
            )
            count, calls, _text, _environment = self.run_stream(
                [record], request(configuration=configuration)
            )
            self.assertEqual(count, 1)
            self.assertEqual(calls[0][0], ("bigcode/the-stack-v2", configuration))
            self.assertEqual(calls[0][1], {
                "split": "train", "streaming": True, "revision": REVISION,
                "token": "external-token",
            })

    def test_projects_only_documented_fields_in_input_order_and_stops_at_limit(self):
        pulled = []

        def rows():
            for index in range(3):
                pulled.append(index)
                name = f"example{index}.py"
                yield row(
                    blob_id=str(index + 1) * 40, path=f"/src/{name}", filename=name
                )

        count, _calls, text, _environment = self.run_stream(rows(), request(rowLimit=2))
        emitted = [json.loads(line) for line in text.splitlines()]
        self.assertEqual(count, 2)
        self.assertEqual(pulled, [0, 1])
        self.assertEqual([entry["swhBlobId"] for entry in emitted], ["1" * 40, "2" * 40])
        self.assertEqual(emitted[0]["path"], "src/example0.py")
        self.assertEqual(list(emitted[0]), [
            "stableRowId", "swhBlobId", "swhContentId", "swhDirectoryId",
            "swhSnapshotId", "swhRevisionId", "repository", "path",
            "detectedLicenses", "detectedLanguage", "generated", "vendor",
            "sourceEncoding", "byteLength", "visitDate", "revisionDate",
            "committerDate",
        ])
        self.assertRegex(emitted[0]["stableRowId"], r"^[0-9a-f]{64}$")
        self.assertNotIn("firstCrawlDate", emitted[0])
        self.assertNotIn("lastCrawlDate", emitted[0])

    def test_normalizes_documented_datetime_and_iso_representations_to_utc(self):
        _count, _calls, text, _environment = self.run_stream([row()])
        emitted = json.loads(text)
        self.assertEqual(emitted["visitDate"], "2023-09-06T10:44:38.631000Z")
        self.assertEqual(emitted["revisionDate"], "2023-09-05T09:30:00Z")
        self.assertEqual(emitted["committerDate"], "2023-09-05T09:30:00Z")

    def test_rejects_request_shape_configuration_revision_limits_and_missing_token(self):
        failures = [
            ("REQUEST_MALFORMED", request(extra=True), "external-token"),
            ("CONFIGURATION_REJECTED", request(configuration="Java"), "external-token"),
            ("REVISION_REJECTED", request(revision="main"), "external-token"),
            ("ROW_LIMIT_REJECTED", request(rowLimit=0), "external-token"),
            ("ROW_LIMIT_REJECTED", request(rowLimit=True), "external-token"),
            ("ROW_LIMIT_REJECTED", request(rowLimit=10_001), "external-token"),
            ("BYTE_LIMIT_REJECTED", request(perBlobByteLimit=262_145), "external-token"),
            ("TOKEN_MISSING", request(), ""),
        ]
        for code, request_value, token in failures:
            calls = []
            self.assert_code(code, lambda rv=request_value, tk=token: stream_metadata(
                rv, load_dataset_fn=lambda *_args, **_kwargs: calls.append(True),
                environment={"HF_TOKEN": tk}, output=io.StringIO(),
            ))
            self.assertEqual(calls, [])

    def test_rejects_schema_identity_and_metadata_screening_failures(self):
        failures = [
            ("ROW_SCHEMA_REJECTED", {**row(), "extra": "value"}),
            ("ROW_SCHEMA_REJECTED", {key: value for key, value in row().items()
                                     if key != "blob_id"}),
            ("IDENTIFIER_REJECTED", row(blob_id="bad/id")),
            ("REPOSITORY_REJECTED", row(repo_name="not-a-repository")),
            ("PATH_REJECTED", row(path="/../secret.py")),
            ("PATH_REJECTED", row(path="src/example.py")),
            ("PATH_REJECTED", row(path="/src/example.ts")),
            ("LICENSE_REJECTED", row(detected_licenses=[])),
            ("LANGUAGE_REJECTED", row(language="TypeScript")),
            ("GENERATED_REJECTED", row(is_generated=True)),
            ("VENDOR_REJECTED", row(is_vendor=True)),
            ("ENCODING_REJECTED", row(src_encoding="utf-8")),
            ("LENGTH_REJECTED", row(length_bytes="128")),
            ("LENGTH_REJECTED", row(length_bytes=262_145)),
            ("DATE_REJECTED", row(visit_date="not-a-date")),
        ]
        for code, bad_row in failures:
            self.assert_code(code, lambda value=bad_row: self.run_stream([value]))

    def test_rejects_changed_documented_column_types_and_relationships(self):
        failures = [
            ("ROW_VALUE_REJECTED", row(license_type="unknown")),
            ("ROW_VALUE_REJECTED", row(branch_name="main")),
            ("ROW_VALUE_REJECTED", row(github_id=True)),
            ("ROW_VALUE_REJECTED", row(star_events_count=-1)),
            ("ROW_VALUE_REJECTED", row(gha_license_id=7)),
            ("DATE_REJECTED", row(gha_created_at="not-a-date")),
            ("ROW_VALUE_REJECTED", row(extension="txt")),
            ("ROW_VALUE_REJECTED", row(filename="other.py")),
        ]
        for code, bad_row in failures:
            self.assert_code(code, lambda value=bad_row: self.run_stream([value]))

    def test_rejects_early_stop_load_and_iteration_failures_with_stable_codes(self):
        self.assert_code("EARLY_STOP", lambda: self.run_stream([], request(rowLimit=1)))

        def load_failure(*_args, **_kwargs):
            raise RuntimeError("Bearer private-token")

        self.assert_code("DATASET_LOAD_FAILED", lambda: stream_metadata(
            request(), load_dataset_fn=load_failure,
            environment={"HF_TOKEN": "external-token"}, output=io.StringIO(),
        ))

        def failed_rows():
            raise RuntimeError("account@example.test")
            yield row()

        self.assert_code("STREAM_FAILED", lambda: self.run_stream(failed_rows()))

    def test_uses_and_cleans_isolated_cache_environment_on_success_and_failure(self):
        for rows in ([row()], []):
            observed_paths = []
            environment = {"HF_TOKEN": "external-token", "HF_HOME": "prior-home"}

            def loader(*_args, **_kwargs):
                observed_paths.extend([
                    environment["HF_HOME"], environment["HF_DATASETS_CACHE"],
                    environment["HUGGINGFACE_HUB_CACHE"],
                ])
                self.assertTrue(all(os.path.isdir(path) for path in observed_paths))
                return iter(rows)

            callback = lambda: stream_metadata(
                request(), load_dataset_fn=loader, environment=environment,
                output=io.StringIO(),
            )
            if rows:
                callback()
            else:
                self.assert_code("EARLY_STOP", callback)
            self.assertEqual(environment, {"HF_TOKEN": "external-token", "HF_HOME": "prior-home"})
            self.assertTrue(all(not os.path.exists(path) for path in observed_paths))


if __name__ == "__main__":
    unittest.main()
