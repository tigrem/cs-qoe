package expo.modules.callmetrics
import android.Manifest
import android.content.pm.PackageManager
import android.telephony.PhoneStateListener
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

data class CallEvent(
  val state: String,
  val timestamp: Long,
)

class CallMetricsModule : Module() {
  private var telephonyManager: TelephonyManager? = null
  private var listener: PhoneStateListener? = null

  override fun definition() = ModuleDefinition {
    Name("CallMetrics")

    Events("callMetrics:update")

    Function("isPermissionGranted") {
      val context = appContext.reactContext ?: return@Function false
      ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.READ_PHONE_STATE
      ) == PackageManager.PERMISSION_GRANTED
    }

    AsyncFunction("start") {
      val context = appContext.reactContext ?: return@AsyncFunction false

      if (ContextCompat.checkSelfPermission(
          context,
          Manifest.permission.READ_PHONE_STATE
        ) != PackageManager.PERMISSION_GRANTED
      ) {
        // JS must request permission first.
        return@AsyncFunction false
      }

      if (telephonyManager == null) {
        telephonyManager =
          context.getSystemService(TelephonyManager::class.java)
      }

      if (listener == null) {
        listener = object : PhoneStateListener() {
          override fun onCallStateChanged(state: Int, phoneNumber: String?) {
            super.onCallStateChanged(state, phoneNumber)
            val stateName = when (state) {
              TelephonyManager.CALL_STATE_IDLE -> "idle"
              TelephonyManager.CALL_STATE_RINGING -> "ringing"
              TelephonyManager.CALL_STATE_OFFHOOK -> "offhook"
              else -> "unknown"
            }

            val event = mapOf(
              "state" to stateName,
              "timestamp" to System.currentTimeMillis(),
              "phoneNumber" to (phoneNumber ?: "")
            )
            sendEvent("callMetrics:update", event)
          }
        }
      }

      telephonyManager?.listen(
        listener,
        PhoneStateListener.LISTEN_CALL_STATE
      )
      true
    }

    AsyncFunction("stop") {
      listener?.let {
        telephonyManager?.listen(it, PhoneStateListener.LISTEN_NONE)
      }
      listener = null
      true
    }
  }
}
