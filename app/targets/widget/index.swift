import ActivityKit
import WidgetKit
import SwiftUI

// Atributos de la Live Activity de la caminata. Debe coincidir (mismo nombre y
// campos) con la copia del módulo nativo (modules/growth-live-activity).
struct CaminataAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var metros: Double
    var segundos: Int
  }
}

func fmtTiempo(_ s: Int) -> String {
  String(format: "%02d:%02d", s / 60, s % 60)
}
func fmtKm(_ metros: Double) -> String {
  String(format: "%.2f", metros / 1000)
}

@available(iOS 16.2, *)
struct CaminataLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: CaminataAttributes.self) { context in
      // Pantalla de bloqueo / banner.
      HStack(spacing: 12) {
        Image(systemName: "figure.walk")
          .font(.title2)
          .foregroundStyle(Color(red: 0.36, green: 0.78, blue: 0.18))
        VStack(alignment: .leading, spacing: 2) {
          Text("Caminata en curso")
            .font(.caption)
            .foregroundStyle(.secondary)
          Text("\(fmtKm(context.state.metros)) km · \(fmtTiempo(context.state.segundos))")
            .font(.headline)
            .monospacedDigit()
        }
        Spacer()
      }
      .padding()
      .activityBackgroundTint(Color.black.opacity(0.55))
      .activitySystemActionForegroundColor(Color(red: 0.36, green: 0.78, blue: 0.18))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Image(systemName: "figure.walk")
            .foregroundStyle(Color(red: 0.36, green: 0.78, blue: 0.18))
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(fmtTiempo(context.state.segundos)).monospacedDigit()
        }
        DynamicIslandExpandedRegion(.center) {
          Text("\(fmtKm(context.state.metros)) km")
            .font(.headline)
            .monospacedDigit()
        }
      } compactLeading: {
        Image(systemName: "figure.walk")
      } compactTrailing: {
        Text(fmtKm(context.state.metros)).monospacedDigit()
      } minimal: {
        Image(systemName: "figure.walk")
      }
    }
  }
}

@main
struct GrowthWidgetBundle: WidgetBundle {
  var body: some Widget {
    if #available(iOS 16.2, *) {
      CaminataLiveActivity()
    }
  }
}
