// SPDX-License-Identifier: GPL-3.0-or-later
package dev.n62.calc;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.UriPermission;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.webkit.MimeTypeMap;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * Files in and out without a storage permission (the storage access framework). No manifest entry.
 * <ul>
 * <li>save({name, mime, text}): Android's own "Save to" screen (ACTION_CREATE_DOCUMENT), once per file
 * (docs/archive/r11-files.md section 1). Resolves {result: "saved" | "cancelled"}, rejects on an I/O error.</li>
 * <li>The sync folder (A65): pickFolder() lets the user pick a folder once (ACTION_OPEN_DOCUMENT_TREE); the plugin takes
 * the persistable read and write grant and keeps the tree URI. folder(), write({name, text}), read({name}), list() and
 * forget() then work on that folder with no dialog, across restarts. Every answer is {result: ...}; with no folder
 * picked, or a grant the user revoked or a folder that is gone, the result is "unavailable" (never a rejection).
 * Text is UTF-8; names are plain file names in the folder itself (no sub-folders).</li>
 * </ul>
 */
@CapacitorPlugin(name = "N62Files")
public class N62FilesPlugin extends Plugin {
    private static final String PREFS = "n62.files";
    private static final String KEY_TREE = "tree";
    /** A read refuses a file over this size (the backup's own cap, docs/archive/r11-files.md section 3.3). */
    static final int READ_MAX = 4 * 1024 * 1024;
    private static final int GRANT = Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;

    @PluginMethod
    public void save(PluginCall call) {
        String name = call.getString("name");
        String mime = call.getString("mime", "application/octet-stream");
        String text = call.getString("text");
        if (name == null || text == null) {
            call.reject("name and text are required");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mime);
        intent.putExtra(Intent.EXTRA_TITLE, name);
        startActivityForResult(call, intent, "saveResult");
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        Uri uri = data != null ? data.getData() : null;
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            call.resolve(new JSObject().put("result", "cancelled"));
            return;
        }
        try (OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (out == null) throw new IOException("no output stream for " + uri);
            out.write(call.getString("text", "").getBytes(StandardCharsets.UTF_8));
        } catch (IOException | RuntimeException e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "write failed");
            return;
        }
        call.resolve(new JSObject().put("result", "saved"));
    }

    // ---- the sync folder (A65) ----

    /** Opens the system folder picker. Resolves {result: "picked", name} or {result: "cancelled"}. */
    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(GRANT | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        Uri kept = keptTree();
        if (kept != null) intent.putExtra(DocumentsContract.EXTRA_INITIAL_URI, kept);
        startActivityForResult(call, intent, "pickFolderResult");
    }

    @ActivityCallback
    private void pickFolderResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        Uri tree = data != null ? data.getData() : null;
        if (result.getResultCode() != Activity.RESULT_OK || tree == null) {
            call.resolve(new JSObject().put("result", "cancelled"));
            return;
        }
        ContentResolver cr = getContext().getContentResolver();
        try {
            cr.takePersistableUriPermission(tree, GRANT);
        } catch (SecurityException e) {
            // the picker gave no persistable write grant: nothing we could keep
            call.resolve(new JSObject().put("result", "unavailable"));
            return;
        }
        Uri old = keptTree();
        prefs().edit().putString(KEY_TREE, tree.toString()).apply();
        if (old != null && !old.equals(tree)) release(old);
        String name = displayName(tree);
        call.resolve(new JSObject().put("result", "picked").put("name", name != null ? name : ""));
    }

    /** The kept folder: {result: "ok", name} while its grant holds, else {result: "unavailable"}. */
    @PluginMethod
    public void folder(PluginCall call) {
        Uri tree = usableTree();
        String name = tree != null ? displayName(tree) : null;
        if (name == null) {
            unavailable(call);
            return;
        }
        call.resolve(new JSObject().put("result", "ok").put("name", name));
    }

    /** Drops the kept folder and gives its grant back. Resolves {result: "ok"}. */
    @PluginMethod
    public void forget(PluginCall call) {
        Uri old = keptTree();
        prefs().edit().remove(KEY_TREE).apply();
        if (old != null) release(old);
        call.resolve(new JSObject().put("result", "ok"));
    }

    /** write({name, text}): creates the file or replaces its content. {result: "written" | "unavailable"}; rejects on an I/O error. */
    @PluginMethod
    public void write(PluginCall call) {
        String name = call.getString("name");
        String text = call.getString("text");
        if (!FolderNames.valid(name) || text == null) {
            call.reject("a plain file name and text are required");
            return;
        }
        Uri tree = usableTree();
        if (tree == null) {
            unavailable(call);
            return;
        }
        ContentResolver cr = getContext().getContentResolver();
        try {
            Uri doc = child(tree, name);
            if (doc == null) {
                doc = DocumentsContract.createDocument(cr, rootDoc(tree), mimeOf(name), name);
                if (doc == null) throw new IOException("could not create " + name);
            }
            try (OutputStream out = cr.openOutputStream(doc, "wt")) {
                if (out == null) throw new IOException("no output stream for " + name);
                out.write(text.getBytes(StandardCharsets.UTF_8));
            }
        } catch (SecurityException | IllegalArgumentException e) {
            // revoked or gone between the check and the write
            unavailable(call);
            return;
        } catch (IOException | RuntimeException e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "write failed");
            return;
        }
        call.resolve(new JSObject().put("result", "written"));
    }

    /** read({name}): {result: "ok", text} | {result: "missing"} | {result: "unavailable"}; rejects on an I/O error or a file over READ_MAX. */
    @PluginMethod
    public void read(PluginCall call) {
        String name = call.getString("name");
        if (!FolderNames.valid(name)) {
            call.reject("a plain file name is required");
            return;
        }
        Uri tree = usableTree();
        if (tree == null) {
            unavailable(call);
            return;
        }
        try {
            Uri doc = child(tree, name);
            if (doc == null) {
                call.resolve(new JSObject().put("result", "missing"));
                return;
            }
            try (InputStream in = getContext().getContentResolver().openInputStream(doc)) {
                if (in == null) throw new IOException("no input stream for " + name);
                call.resolve(new JSObject().put("result", "ok").put("text", readUtf8(in)));
            }
        } catch (SecurityException | IllegalArgumentException e) {
            unavailable(call);
        } catch (IOException | RuntimeException e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "read failed");
        }
    }

    /** list(): {result: "ok", files: [{name, size, modified}]} (files only, no folders) | {result: "unavailable"}. */
    @PluginMethod
    public void list(PluginCall call) {
        Uri tree = usableTree();
        if (tree == null) {
            unavailable(call);
            return;
        }
        String[] cols = {
            DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE,
            DocumentsContract.Document.COLUMN_SIZE, DocumentsContract.Document.COLUMN_LAST_MODIFIED,
        };
        JSArray files = new JSArray();
        try (Cursor c = getContext().getContentResolver().query(children(tree), cols, null, null, null)) {
            if (c == null) throw new SecurityException("no cursor");
            while (c.moveToNext()) {
                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(c.getString(1))) continue;
                files.put(new JSObject()
                    .put("name", c.getString(0))
                    .put("size", c.isNull(2) ? 0 : c.getLong(2))
                    .put("modified", c.isNull(3) ? 0 : c.getLong(3)));
            }
        } catch (SecurityException | IllegalArgumentException e) {
            unavailable(call);
            return;
        } catch (RuntimeException e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "list failed");
            return;
        }
        call.resolve(new JSObject().put("result", "ok").put("files", files));
    }

    // ---- helpers ----

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private Uri keptTree() {
        String s = prefs().getString(KEY_TREE, null);
        return s != null ? Uri.parse(s) : null;
    }

    /** The kept tree while Android still lists our persisted read and write grant on it, else null. */
    private Uri usableTree() {
        Uri tree = keptTree();
        if (tree == null) return null;
        for (UriPermission p : getContext().getContentResolver().getPersistedUriPermissions()) {
            if (p.getUri().equals(tree) && p.isReadPermission() && p.isWritePermission()) return tree;
        }
        return null;
    }

    private void release(Uri tree) {
        try {
            getContext().getContentResolver().releasePersistableUriPermission(tree, GRANT);
        } catch (SecurityException e) {
            // already gone
        }
    }

    private static Uri rootDoc(Uri tree) {
        return DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
    }

    private static Uri children(Uri tree) {
        return DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
    }

    /** The folder's name as the provider shows it, or null when it cannot be read (revoked, gone). */
    private String displayName(Uri tree) {
        String[] cols = {DocumentsContract.Document.COLUMN_DISPLAY_NAME};
        try (Cursor c = getContext().getContentResolver().query(rootDoc(tree), cols, null, null, null)) {
            return c != null && c.moveToFirst() ? c.getString(0) : null;
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** The document of the file called exactly `name` directly in the folder, or null. */
    private Uri child(Uri tree, String name) {
        String[] cols = {DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE};
        try (Cursor c = getContext().getContentResolver().query(children(tree), cols, null, null, null)) {
            if (c == null) throw new SecurityException("no cursor");
            while (c.moveToNext()) {
                if (name.equals(c.getString(1)) && !DocumentsContract.Document.MIME_TYPE_DIR.equals(c.getString(2))) {
                    return DocumentsContract.buildDocumentUriUsingTree(tree, c.getString(0));
                }
            }
        }
        return null;
    }

    /**
     * The type a new file is created with. A type the extension does not imply would make some providers append their
     * own extension ("x.json.txt"); octet-stream never does.
     */
    private static String mimeOf(String name) {
        int dot = name.lastIndexOf('.');
        String ext = dot > 0 ? name.substring(dot + 1).toLowerCase(Locale.ROOT) : "";
        String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return mime != null ? mime : "application/octet-stream";
    }

    private static String readUtf8(InputStream in) throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        byte[] chunk = new byte[64 * 1024];
        int n;
        while ((n = in.read(chunk)) != -1) {
            if (buf.size() + n > READ_MAX) throw new IOException("file over " + READ_MAX + " bytes");
            buf.write(chunk, 0, n);
        }
        return new String(buf.toByteArray(), StandardCharsets.UTF_8);
    }

    private static void unavailable(PluginCall call) {
        call.resolve(new JSObject().put("result", "unavailable"));
    }
}
