# Platform Engineer Memory

- On Windows, spawnSync against plugin/bin/geas must use process.execPath as argv[0] and the script path as argv[1]; shebang routing is shell-specific (Git Bash works, raw spawn does not)
