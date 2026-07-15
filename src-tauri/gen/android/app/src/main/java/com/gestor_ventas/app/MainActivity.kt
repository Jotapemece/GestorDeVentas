package com.gestor_ventas.app

import android.os.Bundle
import android.view.View
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    hideSystemBars()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) hideSystemBars()
  }

  private fun hideSystemBars() {
    window.decorView.systemUiVisibility = (
      View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
      or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
      or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
      or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
      or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
      or View.SYSTEM_UI_FLAG_FULLSCREEN
    )
  }
}
