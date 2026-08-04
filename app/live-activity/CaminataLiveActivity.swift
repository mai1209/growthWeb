//
//  CaminataLiveActivity.swift
//  Live Activity de la caminata (km + tiempo).
//  Pertenece SOLO al target del widget ("GrowthWidget").
//
//  Después de crear el Widget Extension en Xcode, agregá este archivo al target
//  del widget y, en el archivo "…Bundle.swift" que generó Xcode, incluí
//  `CaminataLiveActivity()` dentro del `body`.
//
import ActivityKit
import WidgetKit
import SwiftUI

private let brand = Color(red: 0.36, green: 0.78, blue: 0.18) // verde Growth #5DC72D

private func fmtKm(_ metros: Double) -> String {
  String(format: "%.2f", metros / 1000)
}
private func fmtTiempo(_ s: Int) -> String {
  String(format: "%02d:%02d", s / 60, s % 60)
}

struct CaminataLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: CaminataActivityAttributes.self) { context in
      // ----- Pantalla bloqueada / banner -----
      HStack(spacing: 12) {
        Image(systemName: "figure.walk")
          .font(.title2)
          .foregroundColor(brand)
        VStack(alignment: .leading, spacing: 2) {
          Text("Caminata en curso")
            .font(.caption)
            .foregroundColor(.secondary)
          Text("\(fmtKm(context.state.metros)) km · \(fmtTiempo(context.state.segundos))")
            .font(.system(size: 20, weight: .heavy, design: .rounded))
            .monospacedDigit()
        }
        Spacer()
      }
      .padding(14)
      .activityBackgroundTint(Color.black.opacity(0.55))
      .activitySystemActionForegroundColor(brand)

    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Image(systemName: "figure.walk").foregroundColor(brand)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(fmtTiempo(context.state.segundos)).monospacedDigit().foregroundColor(brand)
        }
        DynamicIslandExpandedRegion(.center) {
          Text("\(fmtKm(context.state.metros)) km")
            .font(.headline)
            .monospacedDigit()
        }
      } compactLeading: {
        Image(systemName: "figure.walk").foregroundColor(brand)
      } compactTrailing: {
        Text(fmtKm(context.state.metros)).monospacedDigit().foregroundColor(brand)
      } minimal: {
        Image(systemName: "figure.walk").foregroundColor(brand)
      }
      .keylineTint(brand)
    }
  }
}
