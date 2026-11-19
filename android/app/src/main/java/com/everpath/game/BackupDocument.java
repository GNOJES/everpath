package com.everpath.game;

import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "BackupDocument")
public class BackupDocument extends Plugin {
    @PluginMethod
    public void create(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("filename"));
        startActivityForResult(call, intent, "onDocument");
    }

    @ActivityCallback
    private void onDocument(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject response = new JSObject();
        if (result.getResultCode() == Activity.RESULT_CANCELED) {
            response.put("saved", false);
            call.resolve(response);
            return;
        }
        Intent data = result.getData();
        String text = call.getString("text");
        if (data == null || data.getData() == null || text == null) {
            call.reject("Missing document");
            return;
        }
        try (OutputStream out = getContext().getContentResolver().openOutputStream(data.getData(), "wt")) {
            if (out == null) throw new IOException("Cannot open document");
            out.write(text.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            call.reject("Cannot save backup", e);
            return;
        }
        response.put("saved", true);
        call.resolve(response);
    }
}
