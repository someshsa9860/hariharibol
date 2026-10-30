"""Sakha Speech: makes HariHariBol's narration audio ahead of time and uploads it to S3."""

# Part of every audio fingerprint: raise it when a change to text handling or audio processing should
# make every file again.
PIPELINE_VERSION = "1"


class Stopped(Exception):
    """A person asked a job to stop. Raised between pieces and between verses, so nothing is left half written."""
