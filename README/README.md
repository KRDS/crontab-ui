Crontab UI
==========

Forked and heavily modified from 
[alseambusher/crontab-ui](https://github.com/alseambusher/crontab-ui).

## Intro

Really got not much in common with the original - instead of using an internal 
DB it loads and writes directly to the system crontab for the user it runs as.

Most advanced features like backup, import & export have been removed in favor 
of a simpler usage model. Not for suitable everyone, but fits the purpose we
need it for.

### Conflicting Updates

Memorizes an MD5 hash of the crontab as it was last read. If on update the 
current crontabs hashsum doesn't match the update is rejected.

The read & hash check operation is not atomic (even in  Node.js's single-thread
model). It should be safe enough for most scenarios, but there is no strong 
protection against concurrent writes - Latest write wins.

## Usage

Fork and run `node app.js`. Open webbrowser on port `8000` by default.

## Supported Platforms

Anything that has a `crontab` command should work.

## License

[MIT](LICENSE.md)
