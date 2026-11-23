// SPDX-License-Identifier: GPL-3.0-or-later
package dev.n62.calc;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * A266: the status and navigation bars follow the look's screen colour (app/src/theme/bars.ts, called by lookApply.ts).
 * set({color: "#rrggbb", light: boolean}) puts the window's background behind the bars in `color` (from Android 15 the
 * bar colours are ignored and the window shows through), below API 35 also the bars' own colours, and sets the icons:
 * `light` true means a light colour and dark icons. styles.xml keeps the N62 Dark values for the splash and the first frame.
 */
@CapacitorPlugin(name = "N62Bars")
public class N62BarsPlugin extends Plugin {
    @PluginMethod
    public void set(PluginCall call) {
        final String hex = call.getString("color");
        final boolean light = Boolean.TRUE.equals(call.getBoolean("light"));
        final int color;
        try {
            color = Color.parseColor(hex);
        } catch (RuntimeException e) { // null or not a colour
            call.reject("color must be #rrggbb");
            return;
        }
        if (getActivity() == null) {
            call.reject("no activity");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                Window window = getActivity().getWindow();
                window.setBackgroundDrawable(new ColorDrawable(color));
                if (Build.VERSION.SDK_INT < 35) { // 35 and up ignore both (edge to edge)
                    window.setStatusBarColor(color);
                    window.setNavigationBarColor(color);
                }
                WindowInsetsControllerCompat c = WindowCompat.getInsetsController(window, window.getDecorView());
                c.setAppearanceLightStatusBars(light);
                c.setAppearanceLightNavigationBars(light);
                call.resolve();
            } catch (RuntimeException e) {
                call.reject(e.getMessage());
            }
        });
    }
}
