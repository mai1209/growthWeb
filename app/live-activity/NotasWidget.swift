//
//  NotasWidget.swift
//  Widget de home screen que muestra las notas más recientes de Growth.
//  Pertenece SOLO al target del widget ("GrowthWidgetExtension").
//
//  Lee las notas desde el App Group compartido "group.app.growthmanager.mobile"
//  (las escribe la app con NotasWidgetModule). Requiere que el App Group esté
//  activado en Signing & Capabilities de la app y del widget.
//
import WidgetKit
import SwiftUI

private let brand = Color(red: 0.36, green: 0.78, blue: 0.18) // verde Growth #5DC72D
private let appGroup = "group.app.growthmanager.mobile"
private let notasKey = "notas"

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
    NotasEntry(date: Date(), notas: [NotaItem(titulo: "Tus notas", texto: "Escribí una nota en Growth y aparece acá.")])
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
    if let raw = def?.string(forKey: notasKey),
       let data = raw.data(using: .utf8),
       let notas = try? JSONDecoder().decode([NotaItem].self, from: data) {
      return NotasEntry(date: Date(), notas: notas)
    }
    return NotasEntry(date: Date(), notas: [])
  }
}

struct NotasWidgetEntryView: View {
  @Environment(\.widgetFamily) var family
  var entry: NotasEntry

  var body: some View {
    let count = family == .systemSmall ? 1 : 3
    let notas = Array(entry.notas.prefix(count))
    VStack(alignment: .leading, spacing: 8) {
      HStack(spacing: 5) {
        Image(systemName: "note.text").font(.caption2).foregroundColor(brand)
        Text("Notas").font(.caption2.weight(.bold)).foregroundColor(.secondary)
      }
      if notas.isEmpty {
        Text("Escribí una nota en Growth y la ves acá.")
          .font(.footnote)
          .foregroundColor(.secondary)
      } else {
        ForEach(notas, id: \.self) { n in
          VStack(alignment: .leading, spacing: 1) {
            if !n.titulo.isEmpty {
              Text(n.titulo)
                .font(.footnote.weight(.semibold))
                .lineLimit(1)
            }
            if !n.texto.isEmpty {
              Text(n.texto)
                .font(.caption2)
                .foregroundColor(.secondary)
                .lineLimit(family == .systemSmall ? 3 : 2)
            }
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
    .configurationDisplayName("Notas")
    .description("Tus notas más recientes de Growth.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
