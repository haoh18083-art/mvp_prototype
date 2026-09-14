#!/usr/bin/env python3
"""原型预览服务器（禁用浏览器缓存）。

替代 `python -m http.server 8777`：每个响应都带 Cache-Control: no-store，
并忽略条件请求（If-Modified-Since / If-None-Match）强制返回完整内容，
从而彻底避免"改了文件但浏览器还显示旧样子"的缓存问题——普通刷新即所见即所得。

用法：
    cd 原型目录
    python3 dev-server.py            # 默认 8777，仅绑定 127.0.0.1
    python3 dev-server.py 8888       # 指定端口
"""
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

DOCROOT = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        # 去掉条件请求头，避免旧缓存借 304 复用旧副本；始终返回完整内容。
        for h in ("If-Modified-Since", "If-None-Match"):
            if h in self.headers:
                del self.headers[h]
        return super().send_head()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
    handler = partial(NoCacheHandler, directory=DOCROOT)
    with ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"预览服务器（no-store）已启动：http://127.0.0.1:{port}/  根目录 {DOCROOT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n已停止。")


if __name__ == "__main__":
    main()
