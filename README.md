
# RSG.IO

## Setup

```bash
$ python -m virtualenv venv3
$ source venv3/bin/activate
$ pip install -r requirements.txt
```

**Add subfork API keys to the environment**

**Subfork file size limit: 1MB**

```bash
$ ./bin/squash.sh <input> <output> <level>
```

For example:

```bash
$ ./bin/squash.sh tmp/photo static/photo 7
```

## Testing

```bash
$ subfork run
```

## Deploy

```bash
$ subfork deploy -c <comment>
```

