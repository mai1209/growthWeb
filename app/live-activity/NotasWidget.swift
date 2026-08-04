//
//  NotasWidget.swift
//  Widget de home screen que muestra las TAREAS pendientes de hoy de Growth,
//  ordenadas por horario. Pertenece SOLO al target del widget ("GrowthWidgetExtension").
//
//  (El nombre de archivo/struct quedó como "Notas" por compatibilidad con el
//  proyecto ya cableado, pero muestra tareas.)
//
//  Lee las tareas desde el App Group compartido "group.app.growthmanager.mobile"
//  (las escribe la app con NotasWidgetModule).
//
import WidgetKit
import SwiftUI

private let brand = Color(red: 0.36, green: 0.78, blue: 0.18) // verde Growth #5DC72D
private let appGroup = "group.app.growthmanager.mobile"
private let itemsKey = "notas"

// Color desde hex ("#rrggbb"). Si no parsea, usa el verde de marca.
extension Color {
  init(growthHex hex: String?) {
    let s = (hex ?? "").trimmingCharacters(in: CharacterSet(charactersIn: "# ")).uppercased()
    var v: UInt64 = 0
    guard s.count == 6, Scanner(string: s).scanHexInt64(&v) else { self = brand; return }
    self = Color(
      red: Double((v >> 16) & 0xFF) / 255.0,
      green: Double((v >> 8) & 0xFF) / 255.0,
      blue: Double(v & 0xFF) / 255.0
    )
  }
}

struct NotaItem: Codable, Hashable {
  var titulo: String
  var hora: String?
  var color: String?

  enum CodingKeys: String, CodingKey { case titulo, hora, color }

  init(titulo: String, hora: String?, color: String? = nil) {
    self.titulo = titulo
    self.hora = hora
    self.color = color
  }

  // Decode tolerante: si falta algún campo (o sobran, como el viejo "texto"),
  // no rompe — así un cambio de formato nunca deja el widget vacío.
  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    titulo = (try? c.decode(String.self, forKey: .titulo)) ?? ""
    hora = try? c.decode(String.self, forKey: .hora)
    color = try? c.decode(String.self, forKey: .color)
  }
}

struct NotasEntry: TimelineEntry {
  let date: Date
  let notas: [NotaItem]
}

struct NotasProvider: TimelineProvider {
  func placeholder(in context: Context) -> NotasEntry {
    NotasEntry(date: Date(), notas: [
      NotaItem(titulo: "Hacer gym / caminar", hora: "08:00"),
      NotaItem(titulo: "Tomar magnesio", hora: "Noche"),
    ])
  }
  func getSnapshot(in context: Context, completion: @escaping (NotasEntry) -> Void) {
    completion(leerEntry())
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<NotasEntry>) -> Void) {
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

struct FilaTarea: View {
  let item: NotaItem
  var body: some View {
    let c = Color(growthHex: item.color)
    HStack(alignment: .firstTextBaseline, spacing: 8) {
      RoundedRectangle(cornerRadius: 1.5)
        .fill(c)
        .frame(width: 3, height: 13)
      Text((item.hora ?? "").isEmpty ? "·" : item.hora!)
        .font(.caption2.weight(.bold))
        .monospacedDigit()
        .foregroundColor(c)
        .frame(width: 46, alignment: .leading)
        .lineLimit(1)
      Text(item.titulo.isEmpty ? "Sin título" : item.titulo)
        .font(.footnote)
        .lineLimit(1)
        .foregroundColor(.primary)
      Spacer(minLength: 0)
    }
  }
}

struct NotasWidgetEntryView: View {
  @Environment(\.widgetFamily) var family
  var entry: NotasEntry

  var body: some View {
    let count = family == .systemSmall ? 4 : 7
    let items = Array(entry.notas.prefix(count))
    VStack(alignment: .leading, spacing: 0) {
      HStack(spacing: 5) {
        Image(systemName: "checklist").font(.caption2.weight(.bold)).foregroundColor(brand)
        Text("Tareas de hoy").font(.caption2.weight(.bold)).foregroundColor(.secondary)
        Spacer(minLength: 0)
        if !items.isEmpty {
          Text("\(entry.notas.count)")
            .font(.caption2.weight(.bold))
            .foregroundColor(brand)
        }
      }
      .padding(.bottom, 7)

      if items.isEmpty {
        Spacer(minLength: 0)
        Text("¡Sin tareas pendientes! 🎉")
          .font(.footnote)
          .foregroundColor(.secondary)
          .frame(maxWidth: .infinity, alignment: .center)
        Spacer(minLength: 0)
      } else {
        VStack(alignment: .leading, spacing: 6) {
          ForEach(items, id: \.self) { FilaTarea(item: $0) }
        }
        Spacer(minLength: 0)
      }
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
    .description("Tus tareas pendientes de hoy, ordenadas por horario.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
