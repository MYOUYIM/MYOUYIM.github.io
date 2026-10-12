---
layout: default
title:
---

{% for post in site.posts %}
<article class="post">
  <h2><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h2>
  <p class="date">{{ post.date | date: "%Y年%m月%d日" }}</p>
  <p>{{ post.excerpt | strip_html | truncate: 80 }}</p>
</article>
{% endfor %}