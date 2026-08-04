//
//  CaminataActivityAttributes.swift
//  Datos de la Live Activity de la caminata.
//
//  IMPORTANTE: este archivo debe pertenecer a DOS targets:
//   - "GrowthManager" (la app, que prende/actualiza/apaga la actividad)
//   - "GrowthWidget"  (el widget, que la dibuja)
//  En Xcode: seleccioná el archivo → File Inspector → "Target Membership" →
//  tildá LOS DOS targets.
//
import ActivityKit
import Foundation

struct CaminataActivityAttributes: ActivityAttributes {
    // Estado dinámico (lo actualiza la app cada segundo).
    public struct ContentState: Codable, Hashable {
        var metros: Double     // distancia acumulada
        var segundos: Int      // tiempo transcurrido
    }
    // Sin datos fijos: la caminata no tiene atributos que no cambien.
}
