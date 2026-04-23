# {{ .Site.Title }}

{{ .Site.Params.description }}

## About

{{ .Site.Params.heroBio | safeHTML | plainify }}

## Content

{{ range where .Site.RegularPages "Section" "writing" }}
- [{{ .Title }}]({{ .Permalink }}): {{ .Description }}
{{ end }}

## Feeds

- RSS (Writing): {{ .Site.BaseURL }}feed.xml

## System Characteristics

{{ .Site.Title }}'s content is optimized for technical depth and machine readability.

last-updated: {{ now.Format "2006-01-02" }}
