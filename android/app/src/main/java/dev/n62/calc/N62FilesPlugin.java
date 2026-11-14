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
import android.os.Build;
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
 * <li>append({name, text}) (A100) adds text to the end of a file in that folder ("wa"), creating it when absent; it never
 * truncates or rewrites, so a crash cannot lose the lines already there. deviceModel() gives Build.MODEL.</li>
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

    /**
     * write({name, text}): creates the file or replaces it whole (A137). {result: "written" | "unavailable"}; rejects on an
     * I/O error, the file under `name` then unchanged. A provider's rename never replaces an existing name (it makes
     * "name (1)"), so the order is:
     * <ol>
     * <li>recover(): put right what a kill left of an earlier write;</li>
     * <li>the new text under STAGED_NEW + name, checked whole (COLUMN_SIZE, or read back when the provider gives no size);</li>
     * <li>the old file renamed to STAGED_OLD + name;</li>
     * <li>the staged new file renamed to `name`;</li>
     * <li>the old file deleted.</li>
     * </ol>
     * A kill or an error leaves under `name` the old file or the new one, never a cut file; between steps 3 and 4 (two
     * renames, milliseconds) `name` is absent, the next write puts the new file there and read() reads it. list() never
     * shows a staged name.
     */
    @PluginMethod
    public void write(PluginCall call) {
        String name = call.getString("name");
        String text = call.getString("text");
        if (!FolderNames.valid(name) || text == null) {
            call.reject("a plain file name and text are required");
            return;
        }
        if (!FolderNames.valid(STAGED_OLD + name)) {
            call.reject("a name of at most " + (255 - STAGED_OLD.length()) + " bytes is required to replace it whole");
            return;
        }
        Uri tree = usableTree();
        if (tree == null) {
            unavailable(call);
            return;
        }
        ContentResolver cr = getContext().getContentResolver();
        try {
            Uri doc = recover(tree, name);
            byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
            Uri fresh = DocumentsContract.createDocument(cr, rootDoc(tree), "application/octet-stream", STAGED_NEW + name);
            if (fresh == null) throw new IOException("could not create " + STAGED_NEW + name);
            try {
                if (!(STAGED_NEW + name).equals(nameOf(fresh))) throw new IOException("the provider renamed " + STAGED_NEW + name);
                try (OutputStream out = cr.openOutputStream(fresh, "wt")) {
                    if (out == null) throw new IOException("no output stream for " + STAGED_NEW + name);
                    writeBytes(out, bytes, call);
                }
                if (!holds(fresh, bytes)) throw new IOException("the new text did not reach " + STAGED_NEW + name + " whole");
            } catch (IOException | RuntimeException e) {
                deleteQuietly(fresh);
                throw e;
            }
            stallAt(call, "checked");
            Uri aside = doc != null ? renameTo(doc, name, STAGED_OLD + name) : null;
            stallAt(call, "aside");
            renameTo(fresh, STAGED_NEW + name, name);
            if (aside != null) deleteQuietly(aside);
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

    /**
     * append({name, text}) (A100): creates the file when absent, then opens it "wa" (write, append) and adds the text; the
     * earlier content is never rewritten. {result: "appended", before, after} with the provider's COLUMN_SIZE in bytes
     * before and after (-1 when it does not say) | {result: "unavailable"}; rejects on an I/O error.
     */
    @PluginMethod
    public void append(PluginCall call) {
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
        Uri doc;
        long before;
        try {
            doc = child(tree, name);
            if (doc == null) {
                doc = DocumentsContract.createDocument(cr, rootDoc(tree), mimeOf(name), name);
                if (doc == null) throw new IOException("could not create " + name);
            }
            before = sizeOf(doc);
            try (OutputStream out = cr.openOutputStream(doc, "wa")) {
                if (out == null) throw new IOException("no output stream for " + name);
                out.write(text.getBytes(StandardCharsets.UTF_8));
            }
        } catch (SecurityException | IllegalArgumentException e) {
            // revoked or gone between the check and the append
            unavailable(call);
            return;
        } catch (IOException | RuntimeException e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "append failed");
            return;
        }
        call.resolve(new JSObject().put("result", "appended").put("before", before).put("after", sizeOf(doc)));
    }

    /** deviceModel() (A100): {result: "ok", model} with Build.MODEL, the line a result file records its device with. */
    @PluginMethod
    public void deviceModel(PluginCall call) {
        call.resolve(new JSObject().put("result", "ok").put("model", Build.MODEL != null ? Build.MODEL : ""));
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
            Uri doc = readable(tree, name);
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
                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(c.getString(1)) || staged(c.getString(0))) continue;
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

    /**
     * The test build's seams (A137; BuildConfig.TEST_SEAMS, build.sh --test only; every other build writes the bytes whole):
     * failAfter n writes the first n bytes, then throws an IOException (a full disk, a provider error); stallAfter n writes
     * the first n bytes and waits 20 s before the rest, so app/test-device/folder.rec.ts can kill the app mid-write;
     * stallAt "checked" | "aside" (stallAt()) waits 20 s after write()'s step 2 or 3.
     */
    private static void writeBytes(OutputStream out, byte[] bytes, PluginCall call) throws IOException {
        int failAfter = BuildConfig.TEST_SEAMS ? call.getInt("failAfter", -1) : -1;
        int stallAfter = BuildConfig.TEST_SEAMS ? call.getInt("stallAfter", -1) : -1;
        if (failAfter < 0 && stallAfter < 0) {
            out.write(bytes);
            return;
        }
        int end = failAfter >= 0 ? Math.min(failAfter, bytes.length) : bytes.length;
        int stall = stallAfter >= 0 ? Math.min(stallAfter, end) : end;
        out.write(bytes, 0, stall);
        out.flush();
        if (stallAfter >= 0) pause();
        out.write(bytes, stall, end - stall);
        out.flush();
        if (failAfter >= 0) throw new IOException("test seam: failed after " + end + " bytes");
    }

    /** The test build's stallAt seam: waits 20 s when the call names this step (see writeBytes). */
    private static void stallAt(PluginCall call, String step) {
        String at = BuildConfig.TEST_SEAMS ? call.getString("stallAt") : null;
        if (step.equals(at)) pause();
    }

    private static void pause() {
        try {
            Thread.sleep(20_000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    // ---- helpers ----

    /** The staged names of write() (A137): the new text before it takes the name, the old file before it is deleted. */
    static final String STAGED_NEW = ".n62-new~";
    static final String STAGED_OLD = ".n62-old~";

    static boolean staged(String name) {
        return name != null && (name.startsWith(STAGED_NEW) || name.startsWith(STAGED_OLD));
    }

    /**
     * Puts right what a kill left of an earlier write of `name` and returns `name`'s document (null when absent). The old
     * file goes aside only after the new text was checked whole, so with STAGED_OLD present and `name` absent (killed
     * between the two renames) the staged new file is whole and takes the name; with no staged new file left, the old one
     * goes back. Any other staged file is stale and deleted.
     */
    private Uri recover(Uri tree, String name) throws IOException {
        Uri[] found = childrenNamed(tree, name, STAGED_NEW + name, STAGED_OLD + name);
        Uri doc = found[0];
        Uri fresh = found[1];
        Uri aside = found[2];
        if (doc == null && aside != null) {
            if (fresh != null) {
                doc = renameTo(fresh, STAGED_NEW + name, name);
                fresh = null;
            } else {
                doc = renameTo(aside, STAGED_OLD + name, name);
                aside = null;
            }
        }
        ContentResolver cr = getContext().getContentResolver();
        if (fresh != null) DocumentsContract.deleteDocument(cr, fresh);
        if (aside != null) DocumentsContract.deleteDocument(cr, aside);
        return doc;
    }

    /** read()'s document for `name`, changing nothing: `name`, or in the window between write()'s renames the whole new text. */
    private Uri readable(Uri tree, String name) {
        Uri[] found = childrenNamed(tree, name, STAGED_NEW + name, STAGED_OLD + name);
        if (found[0] != null || found[2] == null) return found[0];
        return found[1] != null ? found[1] : found[2];
    }

    /**
     * Renames the document `from` → `to` and checks the provider kept the name: onto a name that exists (another writer,
     * between our query and the rename) it makes "to (1)"; that is renamed back to `from` and the write fails.
     */
    private Uri renameTo(Uri doc, String from, String to) throws IOException {
        ContentResolver cr = getContext().getContentResolver();
        Uri r = DocumentsContract.renameDocument(cr, doc, to);
        if (r == null) r = doc;
        String got = nameOf(r);
        if (!to.equals(got)) {
            try {
                DocumentsContract.renameDocument(cr, r, from);
            } catch (IOException | RuntimeException e) {
                // left as the provider named it
            }
            throw new IOException("the provider named it " + got + ", not " + to);
        }
        return r;
    }

    /** The document's own name as the provider shows it, or null. */
    private String nameOf(Uri doc) {
        String[] cols = {DocumentsContract.Document.COLUMN_DISPLAY_NAME};
        try (Cursor c = getContext().getContentResolver().query(doc, cols, null, null, null)) {
            return c != null && c.moveToFirst() ? c.getString(0) : null;
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** Whether the document holds exactly `bytes`: by COLUMN_SIZE, or read back when the provider does not give a size. */
    private boolean holds(Uri doc, byte[] bytes) throws IOException {
        long size = sizeOf(doc);
        if (size >= 0) return size == bytes.length;
        try (InputStream in = getContext().getContentResolver().openInputStream(doc)) {
            if (in == null) return false;
            byte[] chunk = new byte[64 * 1024];
            int at = 0;
            int n;
            while ((n = in.read(chunk)) != -1) {
                if (at + n > bytes.length) return false;
                for (int i = 0; i < n; i++) if (chunk[i] != bytes[at + i]) return false;
                at += n;
            }
            return at == bytes.length;
        }
    }

    private void deleteQuietly(Uri doc) {
        try {
            DocumentsContract.deleteDocument(getContext().getContentResolver(), doc);
        } catch (IOException | RuntimeException e) {
            // the next write's recover() deletes a staged file left behind
        }
    }

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
        return childrenNamed(tree, name)[0];
    }

    /** For each name, the document of the file called exactly that directly in the folder, or null; one query. */
    private Uri[] childrenNamed(Uri tree, String... names) {
        Uri[] found = new Uri[names.length];
        String[] cols = {DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE};
        try (Cursor c = getContext().getContentResolver().query(children(tree), cols, null, null, null)) {
            if (c == null) throw new SecurityException("no cursor");
            while (c.moveToNext()) {
                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(c.getString(2))) continue;
                for (int i = 0; i < names.length; i++) {
                    if (found[i] == null && names[i].equals(c.getString(1))) {
                        found[i] = DocumentsContract.buildDocumentUriUsingTree(tree, c.getString(0));
                    }
                }
            }
        }
        return found;
    }

    /** The document's size in bytes as the provider reports it (COLUMN_SIZE), or -1 when it does not say. */
    private long sizeOf(Uri doc) {
        String[] cols = {DocumentsContract.Document.COLUMN_SIZE};
        try (Cursor c = getContext().getContentResolver().query(doc, cols, null, null, null)) {
            return c != null && c.moveToFirst() && !c.isNull(0) ? c.getLong(0) : -1;
        } catch (RuntimeException e) {
            return -1;
        }
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
