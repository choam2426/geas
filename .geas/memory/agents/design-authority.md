# Design Authority Memory

- Naming convention changes (underscore to hyphen) have much larger blast radius than initially apparent: _defs.schema.json enum, inline schema enums across 6+ CLI schemas, profiles.json slot_mapping values, integration test literals, memory/agents/ filenames, and 30+ skill text references. Must create exhaustive change manifest and update atomically.
