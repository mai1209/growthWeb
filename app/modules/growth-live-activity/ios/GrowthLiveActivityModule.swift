import ExpoModulesCore
import ActivityKit

// Debe coincidir con la copia del widget (targets/widget/index.swift): mismo
// nombre y campos, para que ActivityKit enrute la actividad al widget correcto.
@available(iOS 16.2, *)
struct CaminataAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var metros: Double
    var segundos: Int
  }
}

public class GrowthLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GrowthLiveActivity")

    // ¿El dispositivo soporta Live Activities y están habilitadas?
    Function("isSupported") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    // Inicia la Live Activity de la caminata. Devuelve el id (o nil).
    Function("start") { (metros: Double, segundos: Int) -> String? in
      if #available(iOS 16.2, *) {
        // Si ya hay una activa, no arrancamos otra.
        if let existente = Activity<CaminataAttributes>.activities.first {
          return existente.id
        }
        let state = CaminataAttributes.ContentState(metros: metros, segundos: segundos)
        do {
          let activity = try Activity.request(
            attributes: CaminataAttributes(),
            content: .init(state: state, staleDate: nil)
          )
          return activity.id
        } catch {
          return nil
        }
      }
      return nil
    }

    // Actualiza los km / tiempo mostrados.
    Function("update") { (metros: Double, segundos: Int) in
      if #available(iOS 16.2, *) {
        let state = CaminataAttributes.ContentState(metros: metros, segundos: segundos)
        Task {
          for activity in Activity<CaminataAttributes>.activities {
            await activity.update(.init(state: state, staleDate: nil))
          }
        }
      }
    }

    // Termina la Live Activity.
    Function("end") {
      if #available(iOS 16.2, *) {
        Task {
          for activity in Activity<CaminataAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
          }
        }
      }
    }
  }
}
