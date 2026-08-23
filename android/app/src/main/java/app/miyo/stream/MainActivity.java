package app.miyo.stream;

import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.widget.FrameLayout;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

    // HTML5 fullscreen (video "maximize" button) state
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Ad protection: ad scripts inside player iframes (e.g. Videasy) try to
        // redirect the app or open the browser via top-level navigations.
        // Block every main-frame navigation that isn't TETO itself or an
        // allowed player domain — instead of Capacitor's default behavior of
        // launching the system browser. Iframe/subframe loads are untouched,
        // so the players keep working.
        this.bridge.setWebViewClient(new BridgeWebViewClient(this.bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request.isForMainFrame() && !isAllowed(request.getUrl().getHost())) {
                    return true; // swallow the navigation (no browser, no redirect)
                }
                return super.shouldOverrideUrlLoading(view, request);
            }

            private boolean isAllowed(String host) {
                if (host == null) return false;
                return host.equals("localhost")
                    || host.equals("127.0.0.1")
                    || host.equals("www.youtube.com")
                    || host.equals("youtube.com")
                    || host.equals("www.youtube-nocookie.com")
                    || host.equals("videasy.net")
                    || host.endsWith(".videasy.net");
            }
        });

        // Fullscreen support: Capacitor's default BridgeWebChromeClient
        // immediately cancels HTML5 fullscreen requests
        // (onShowCustomView -> callback.onCustomViewHidden()), which is why
        // the maximize button in players like Videasy did nothing. Override
        // it to actually render the fullscreen view over the app.
        this.bridge.getWebView().setWebChromeClient(new BridgeWebChromeClient(this.bridge) {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreenView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                fullscreenView = view;
                fullscreenCallback = callback;
                FrameLayout decor = (FrameLayout) getWindow().getDecorView();
                decor.addView(view, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT));
                setSystemBarsHidden(true);
            }

            @Override
            public void onHideCustomView() {
                exitFullscreen();
            }
        });
    }

    private void exitFullscreen() {
        if (fullscreenView == null) return;
        FrameLayout decor = (FrameLayout) getWindow().getDecorView();
        decor.removeView(fullscreenView);
        fullscreenView = null;
        if (fullscreenCallback != null) {
            try {
                fullscreenCallback.onCustomViewHidden();
            } catch (Exception ignored) {}
            fullscreenCallback = null;
        }
        setSystemBarsHidden(false);
    }

    private void setSystemBarsHidden(boolean hidden) {
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (hidden) {
            controller.hide(WindowInsetsCompat.Type.systemBars());
            controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        } else {
            controller.show(WindowInsetsCompat.Type.systemBars());
        }
    }

    @Override
    public void onBackPressed() {
        // Back button exits video fullscreen instead of leaving the page
        if (fullscreenView != null) {
            exitFullscreen();
            return;
        }
        super.onBackPressed();
    }
}
