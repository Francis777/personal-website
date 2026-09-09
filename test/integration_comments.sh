#!/usr/bin/env bash
set -euo pipefail

tmp_dir="$(mktemp -d)"
tmp_override="${tmp_dir}/comments-test-override.yml"
tmp_site="${tmp_dir}/site"
fixture_dir="_posts"
giscus_fixture="${fixture_dir}/2000-01-01-comments-integration-giscus.md"
disqus_fixture="${fixture_dir}/2000-01-02-comments-integration-disqus.md"

cleanup() {
  rm -f "${giscus_fixture}" "${disqus_fixture}"
  rmdir "${fixture_dir}" 2>/dev/null || true
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

cat >"${tmp_override}" <<'YAML'
giscus:
  repo: alshedivat/al-folio
  repo_id: R_kgDOExample
  category: Comments
  category_id: DIC_kwDOExample
disqus_shortname: al-folio
YAML

mkdir -p "${fixture_dir}"

cat >"${giscus_fixture}" <<'MARKDOWN'
---
layout: post
title: Giscus comments integration fixture
date: 2000-01-01 00:00:00
permalink: /test/comments/giscus/
giscus_comments: true
related_posts: false
---

Temporary Giscus integration fixture.
MARKDOWN

cat >"${disqus_fixture}" <<'MARKDOWN'
---
layout: post
title: Disqus comments integration fixture
date: 2000-01-02 00:00:00
permalink: /test/comments/disqus/
disqus_comments: true
related_posts: false
---

Temporary Disqus integration fixture.
MARKDOWN

bundle exec jekyll build --disable-disk-cache --config "_config.yml,${tmp_override}" -d "${tmp_site}" >/dev/null

giscus_page="${tmp_site}/test/comments/giscus/index.html"
disqus_page="${tmp_site}/test/comments/disqus/index.html"

grep -q 'https://giscus.app/client.js' "${giscus_page}"
if grep -q 'giscus comments misconfigured' "${giscus_page}"; then
  echo "unexpected giscus misconfiguration warning in ${giscus_page}" >&2
  exit 1
fi

grep -q 'id="disqus_thread"' "${disqus_page}"
grep -q '.disqus.com/embed.js' "${disqus_page}"

echo "comments integration checks passed"
