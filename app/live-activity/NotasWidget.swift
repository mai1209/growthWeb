//
//  NotasWidget.swift
//  Widget de home screen que muestra las TAREAS pendientes de hoy de Growth.
//  Pertenece SOLO al target del widget ("GrowthWidgetExtension").
//
//  (El nombre de archivo/struct quedó como "Notas" por compatibilidad con el
//  proyecto ya cableado, pero muestra tareas.)
//
//  Lee las tareas desde el App Group compartido "group.app.growthmanager.mobile"
//  (las escribe la app con NotasWidgetModule). Requiere que el App Group esté
//  activado en Signing & Capabilities de la app y del widget.
//
import WidgetKit
import SwiftUI

private let brand = Color(red: 0.36, green: 0.78, blue: 0.18) // verde Growth #5DC72D
private let appGroup = "group.app.growthmanager.mobile"
private let itemsKey = "notas"

struct NotaItem: Codable, Hashable {
  var titulo: String
  var texto: String
}

struct NotasEntry: TimelineEntry {
  let date: Date
  let notas: [NotaItem]
}

struct NotasProvider: TimelineProvider {
  func placeholder(in context: Context) -> NotasEntry {
    NotasEntry(date: Date(), notas: [
      NotaItem(titulo: "Tomar agua", texto: ""),
      NotaItem(titulo: "Entrenar", texto: ""),
    ])
  }
  func getSnapshot(in context: Context, completion: @escaping (NotasEntry) -> Void) {
    completion(leerEntry())
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<NotasEntry>) -> Void) {
    // La app fuerza el refresco al guardar; igual pedimos una actualización por hora.
    let next = Calendar.current.date(byAdding: .hour, value: 1, to: Date()) ?? Date()
    completion(Timeline(entries: [leerEntry()], policy: .after(next)))
  }
  private func leerEntry() -> NotasEntry {
    let def = UserDefaults(suiteName: appGroup)
    if let raw = def?.string(forKey: itemsKey),
       let data = raw.data(using: .utf8),
       let items = try? JSONDecoder().decode([NotaItem].self, from: data) {
      return NotasEntry(date: Date(), notas: items)
    }
    return NotasEntry(date: Date(), notas: [])
  }
}

struct NotasWidgetEntryView: View {
  @Environment(\.widgetFamily) var family
  var entry: NotasEntry

  var body: some View {
    let count = family == .systemSmall ? 4 : 7
    let items = Array(entry.notas.prefix(count))
    VStack(alignment: .leading, spacing: 7) {
      HStack(spacing: 5) {
        Image(systemName: "checklist").font(.caption2).foregroundColor(brand)
        Text("Tareas de hoy").font(.caption2.weight(.bold)).foregroundColor(.secondary)
      }
      if items.isEmpty {
        Text("¡Sin tareas pendientes! 🎉")
          .font(.footnote)
          .foregroundColor(.secondary)
      } else {
        ForEach(items, id: \.self) { t in
          HStack(alignment: .center, spacing: 7) {
            Image(systemName: "circle")
              .font(.system(size: 12))
              .foregroundColor(brand)
            Text(t.titulo.isEmpty ? "Sin título" : t.titulo)
              .font(.footnote)
              .lineLimit(1)
          }
        }
      }
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

struct NotasWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "NotasWidget", provider: NotasProvider()) { entry in
      if #available(iOS 17.0, *) {
        NotasWidgetEntryView(entry: entry)
          .containerBackground(.fill.tertiary, for: .widget)
      } else {
        NotasWidgetEntryView(entry: entry)
          .padding()
      }
    }
    .configurationDisplayName("Tareas")
    .description("Tus tareas pendientes de hoy en Growth.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
