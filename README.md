
# RSG.IO

Personal website built and hosted on [Subfork](https://subfork.com).

## Setup

```bash
$ python -m virtualenv venv3
$ source venv3/bin/activate
$ pip install -r requirements.txt
```

**Add Subfork API keys to the environment**

Compress image files using squash bash script:

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
$ subfork deploy -c <comment> --release
```

