// SPDX-License-Identifier: GPL-3.0-or-later
package dev.n62.calc;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Build;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.util.Log;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Key vibration with a settable strength (app/src/input/haptics.ts). vibrate({ms, amplitude 1..255}) uses
 * VibrationEffect.createOneShot on API 26+ when the motor has amplitude control, and plain vibrate(ms) otherwise.
 * Needs only the normal permission android.permission.VIBRATE.
 *
 * A9 (F41): from API 33 the pulse names its usage, USAGE_PHYSICAL_EMULATION (a key that feels like a key). A pulse
 * without attributes has the usage UNKNOWN, and Android 13+ plays each usage at its own intensity setting: on the
 * owner's Fairphone 6 (Android 16) UNKNOWN and TOUCH were OFF, and dumpsys listed every pulse as ignored_for_settings.
 * The app's own Key vibration switch is the user's choice here, so the system's touch-feedback switch does not mute it.
 *
 * A66: click() is the optional key click (Settings › Key vibration › Key click). With the system's touch sounds on it
 * plays the system's own key-click effect (AudioManager.playSoundEffect(FX_KEY_CLICK)), which Android does not play
 * when they are off; then, and when the effect cannot be played, a 12 ms click made in code (a static AudioTrack, no
 * audio file), so the app's own switch alone decides, as for the pulse.
 */
@CapacitorPlugin(name = "N62Haptics")
public class N62HapticsPlugin extends Plugin {
    private Vibrator vibrator;
    private AudioManager audio;
    private AudioTrack clickTrack;

    @Override
    public void load() {
        vibrator = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
        audio = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
    }

    /** The system's touch sounds are on (Settings › Sound › Touch sounds). */
    private boolean systemClicks() {
        return Settings.System.getInt(getContext().getContentResolver(), Settings.System.SOUND_EFFECTS_ENABLED, 1) == 1;
    }

    /** A 12 ms decaying 2.5 kHz burst, made once. */
    private AudioTrack buildClick() {
        final int rate = 44100;
        final int n = rate * 12 / 1000;
        short[] pcm = new short[n];
        for (int i = 0; i < n; i++) {
            double env = Math.exp(-6.0 * i / n);
            pcm[i] = (short) (Math.sin(2 * Math.PI * 2500 * i / rate) * env * 9000);
        }
        AudioTrack track = new AudioTrack.Builder()
            .setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build())
            .setAudioFormat(new AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(rate)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .build())
            .setBufferSizeInBytes(n * 2)
            .setTransferMode(AudioTrack.MODE_STATIC)
            .setPerformanceMode(AudioTrack.PERFORMANCE_MODE_LOW_LATENCY)
            .build();
        track.write(pcm, 0, n);
        return track;
    }

    @PluginMethod
    public void click(PluginCall call) {
        try {
            boolean system = audio != null && systemClicks();
            if (system) {
                audio.playSoundEffect(AudioManager.FX_KEY_CLICK);
            } else {
                if (clickTrack == null) clickTrack = buildClick();
                clickTrack.stop();
                clickTrack.reloadStaticData();
                clickTrack.play();
            }
            if (BuildConfig.MEASURE) {
                Log.i("N62_HAPTICS", "click system=" + system);
            }
            call.resolve();
        } catch (RuntimeException e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void vibrate(PluginCall call) {
        if (vibrator == null || !vibrator.hasVibrator()) {
            call.resolve();
            return;
        }
        long ms = Math.max(1, Math.min(1000, call.getInt("ms", 20)));
        int amp = Math.max(1, Math.min(255, call.getInt("amplitude", 255)));
        try {
            boolean ctl = Build.VERSION.SDK_INT >= 26 && vibrator.hasAmplitudeControl();
            if (Build.VERSION.SDK_INT >= 26) {
                VibrationEffect effect = VibrationEffect.createOneShot(ms, ctl ? amp : VibrationEffect.DEFAULT_AMPLITUDE);
                if (Build.VERSION.SDK_INT >= 33) {
                    VibrationAttributes attrs = VibrationAttributes.createForUsage(VibrationAttributes.USAGE_PHYSICAL_EMULATION);
                    vibrator.vibrate(effect, attrs);
                } else {
                    vibrator.vibrate(effect);
                }
            } else {
                vibrator.vibrate(ms);
            }
            if (BuildConfig.MEASURE) {
                Log.i("N62_HAPTICS", "vibrate ms=" + ms + " amplitude=" + amp + " ampControl=" + ctl);
            }
            call.resolve();
        } catch (RuntimeException e) {
            call.reject(e.getMessage());
        }
    }
}
