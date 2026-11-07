// SPDX-License-Identifier: GPL-3.0-or-later
package dev.n62.calc;

import java.nio.charset.StandardCharsets;

/**
 * Which names the sync folder accepts (A65): a plain file name directly in the picked folder. No path separator, no NUL,
 * not "." or "..", at most 255 UTF-8 bytes (the usual file-system limit). Plain Java, so tools/folder-names.test.sh
 * checks it with javac alone; app/src/clipboard/folder.ts applies the same rule before it calls the plugin.
 */
final class FolderNames {
    private FolderNames() {}

    static boolean valid(String name) {
        if (name == null || name.isEmpty() || name.equals(".") || name.equals("..")) return false;
        if (name.indexOf('/') >= 0 || name.indexOf('\\') >= 0 || name.indexOf('\0') >= 0) return false;
        return name.getBytes(StandardCharsets.UTF_8).length <= 255;
    }
}
