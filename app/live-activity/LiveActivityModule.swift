//
//  LiveActivityModule.swift
//  Puente entre React Native y ActivityKit (Live Activity de la caminata).
//  Pertenece SOLO al target "GrowthManager" (la app).
//
import Foundation
import ActivityKit

@objc(LiveActivityModule)
class LiveActivityModule: NSObject {

  // Guardamos la actividad en curso (Any para no requerir iOS 16.2 en la propiedad).
  private var current: Any?

  // Inicia la Live Activity al arrancar la caminata.
  @objc(start:segundos:)
  func start(metros: Double, segundos: Double) {
    if #available(iOS 16.2, *) {
      // Si ya hay una activa, la cerramos antes.
      end()
      let state = CaminataActivityAttributes.ContentState(metros: metros, segundos: Int(segundos))
      do {
        let activity = try Activity.request(
          attributes: CaminataActivityAttributes(),
          content: .init(state: state, staleDate: nil)
        )
        self.current = activity
      } catch {
        print("[LiveActivity] start error: \(error)")
      }
    }
  }

  // Actualiza los km / tiempo mostrados.
  @objc(update:segundos:)
  func update(metros: Double, segundos: Double) {
    if #available(iOS 16.2, *) {
      guard let activity = current as? Activity<CaminataActivityAttributes> else { return }
      let state = CaminataActivityAttributes.ContentState(metros: metros, segundos: Int(segundos))
      Task {
        await activity.update(.init(state: state, staleDate: nil))
      }
    }
  }

  // Cierra la Live Activity (al finalizar o cerrar la caminata).
  @objc func end() {
    if #available(iOS 16.2, *) {
      guard let activity = current as? Activity<CaminataActivityAttributes> else { return }
      Task {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
      self.current = nil
    }
  }

  @objc static func requiresMainQueueSetup() -> Bool { return false }
}
