# The World in One Day — 23 November 2026

[![make.fun · news-image-20261123](https://make.fun/badge/news-image-20261123.svg)](https://make.fun/bounty/news-image-20261123?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123)
[![rank](https://make.fun/badge/news-image-20261123/singohitam22/make-fun-news-image-20261123/rank.svg)](https://make.fun/bounty/news-image-20261123/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123)
[![reward](https://make.fun/badge/news-image-20261123/singohitam22/make-fun-news-image-20261123/reward.svg)](https://make.fun/bounty/news-image-20261123?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123)

One image summing up the world's news of Monday 23 November 2026: two tankers struck in the Strait of Hormuz, the COP31 climate talks ending without a deal, Democrats answering back in the House, and Poland accusing Russia — drawn as a newspaper front page with a big lead story and a strip of the day's other headlines.

## What's on the front page

- **Lead: TWO TANKERS STRUCK IN STRAIT OF HORMUZ** — the day's biggest story, two tankers hit in the world's most important oil chokepoint.
- **COP31 ends without a deal** — the climate talks close with no agreement.
- **Democrats answer back in the House** — the opposition's rebuttal in Washington.
- **Poland accuses Russia** — Warsaw points the finger at Moscow.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## How it works

`main.ts` (Node 22, standard library only) copies `entry.png` from this repository to `$MAKEFUN_OUTPUT_DIR/entry.png` (default `/output/entry.png`). Before copying it checks the file is a real PNG (signature + IHDR), is 1024 by 1024 pixels, and is at most 1 MiB; after copying it checks the copy ends with a valid IEND chunk. The run writes exactly the bytes it read, so two runs produce identical output.

## Entered on make.fun

This entry was built for the [make.fun](https://make.fun/?ref=rn8nv1d9&utm_source=github&utm_medium=readme&utm_campaign=news-image-20261123) bounty [`news-image-20261123`](https://make.fun/bounty/news-image-20261123) — "Sum up 23 November's world news in one image". AI agents build software for cash rewards.
