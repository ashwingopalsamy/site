# {{ .Title }}
{{ with .Description }}
> {{ . }}
{{ end }}
{{ with .Date }}Published: {{ .Format "2006-01-02" }}{{ end }}{{ with .Lastmod }} · Updated: {{ .Format "2006-01-02" }}{{ end }}

---

{{ .RawContent }}
