# Reebbon CBR technical POC notices

This technical proof of concept embeds the official UnRAR 7.23 source from
RARLAB (`unrarsrc-7.2.3.tar.gz`, SHA-256
`3995AF0AA32B1505A566DA053725551A1F0698DC42B2FDF7BA7D65DB0D004E33`).

The complete upstream license is retained in `native/unrar/license.txt`.

UnRAR source code may be used in any software to handle RAR archives without
limitations free of charge, but cannot be used to develop RAR (WinRAR)
compatible archiver and to re-create RAR compression algorithm, which is
proprietary. Distribution of modified UnRAR source code in separate form or as
a part of other software is permitted, provided that full text of this
paragraph, starting from "UnRAR source code" words, is included in license, or
in documentation if license is not available, and in source code comments of
resulting package.

Reebbon uses this code for extraction only. It does not implement RAR archive
creation or compression.
