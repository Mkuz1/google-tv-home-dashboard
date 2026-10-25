package com.mk.homedash;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** In the MK Split Screen helper: the launcher's request to press the system split-screen action. */
public class SplitReceiver extends BroadcastReceiver {

    static final String PACKAGE = "com.mk.splithelper";
    static final String ACTION = "com.mk.splithelper.TOGGLE_SPLIT";

    @Override
    public void onReceive(Context context, Intent intent) {
        SplitService.toggleSplit();
    }
}
