package com.mk.homedash;

import android.accessibilityservice.AccessibilityService;
import android.view.accessibility.AccessibilityEvent;

/**
 * Lets the car home screen put two apps side by side. Apps can't enter split screen themselves,
 * so when you switch this on (Settings → Accessibility → MK Split Screen) the launcher uses it only
 * to press the system's "split screen" action. It reads nothing on the screen.
 */
public class SplitService extends AccessibilityService {

    static volatile SplitService instance;

    @Override
    protected void onServiceConnected() {
        instance = this;
    }

    @Override
    public boolean onUnbind(android.content.Intent intent) {
        instance = null;
        return super.onUnbind(intent);
    }

    @Override
    public void onDestroy() {
        instance = null;
        super.onDestroy();
    }

    /** Docks the app in front to one side; the next app opened with LAUNCH_ADJACENT fills the other. */
    static boolean toggleSplit() {
        SplitService s = instance;
        return s != null && s.performGlobalAction(GLOBAL_ACTION_TOGGLE_SPLIT_SCREEN);
    }

    @Override public void onAccessibilityEvent(AccessibilityEvent event) { }
    @Override public void onInterrupt() { }
}
