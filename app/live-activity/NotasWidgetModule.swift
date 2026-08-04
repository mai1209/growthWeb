//
//  NotasWidgetModule.swift
//  Escribe las notas al App Group compartido y refresca el widget de notas.
//  Pertenece SOLO al target "GrowthManager" (la app).
//
import Foundation
import WidgetKit

@objc(NotasWidgetModule)
class NotasWidgetModule: NSObject {

  private let appGroup = "group.app.growthmanager.mobile"
  private let notasKey = "notas"

  // Recibe un JSON con [{ titulo, texto }] (lo arma el service en JS).
  @objc(setNotas:)
  func setNotas(_ json: String) {
    let def = UserDefaults(suiteName: appGroup)
    def?.set(json, forKey: notasKey)
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }

  @objc static func requiresMainQueueSetup() -> Bool { return false }
}
