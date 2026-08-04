//
//  NotasWidget.swift
//  Widget de home screen que muestra las TAREAS pendientes de hoy de Growth
//  con el MISMO estilo que la app/web: cada tarea es una tarjeta con su color.
//  Pertenece SOLO al target del widget ("GrowthWidgetExtension").
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

// RGB (0..1) desde hex "#rrggbb". nil si no parsea.
private func growthRGB(_ hex: String?) -> (Double, Double, Double)? {
  let s = (hex ?? "").trimmingCharacters(in: CharacterSet(charactersIn: "# ")).uppercased()
  var v: UInt64 = 0
  guard s.count == 6, Scanner(string: s).scanHexInt64(&v) else { return nil }
  return (Double((v >> 16) & 0xFF) / 255.0, Double((v >> 8) & 0xFF) / 255.0, Double(v & 0xFF) / 255.0)
}

extension Color {
  init(growthHex hex: String?) {
    if let (r, g, b) = growthRGB(hex) { self = Color(red: r, green: g, blue: b) } else { self = brand }
  }
}

// Texto oscuro sobre colores claros, blanco sobre oscuros (como en la app).
private func growthContrast(_ hex: String?) -> Color {
  guard let (r, g, b) = growthRGB(hex) else { return Color(red: 0.086, green: 0.14, blue: 0.114) }
  let lum = 0.299 * r + 0.587 * g + 0.114 * b
  return lum > 0.6 ? Color(red: 0.086, green: 0.14, blue: 0.114) : .white
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
      NotaItem(titulo: "Hacer gym / caminar", hora: "08:00", color: "#f0c419"),
      NotaItem(titulo: "Tomar magnesio", hora: "Noche", color: "#3f9fe7"),
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

// Tarjeta de tarea con su color de fondo, igual que en la app.
struct FilaTarea: View {
  let item: NotaItem
  var body: some View {
    let bg = Color(growthHex: item.color)
    let fg = growthContrast(item.color)
    HStack(alignment: .top, spacing: 8) {
      Text(item.titulo.isEmpty ? "Sin título" : item.titulo)
        .font(.subheadline.weight(.semibold))
        .lineLimit(3)                                  // texto largo baja de renglón
        .fixedSize(horizontal: false, vertical: true)
        .foregroundColor(fg)
      Spacer(minLength: 4)
      // Hora/momento + círculo, siempre visibles a la derecha (arriba).
      if let h = item.hora, !h.isEmpty {
        Text(h)
          .font(.caption.weight(.bold))
          .monospacedDigit()
          .foregroundColor(fg.opacity(0.85))
      }
      Image(systemName: "circle")
        .font(.system(size: 12, weight: .semibold))
        .foregroundColor(fg.opacity(0.6))
        .padding(.top, 1)
    }
    .padding(.horizontal, 11)
    .padding(.vertical, 11)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading) // estira la altura
    .background(bg)
    .clipShape(RoundedRectangle(cornerRadius: 10))
  }
}

struct NotasWidgetEntryView: View {
  @Environment(\.widgetFamily) var family
  var entry: NotasEntry

  var body: some View {
    // Chico 3, mediano 2 (tarjetas más grandes), grande 4.
    let count = family == .systemLarge ? 4 : (family == .systemMedium ? 2 : 3)
    let items = Array(entry.notas.prefix(count))
    VStack(alignment: .leading, spacing: 8) {
      HStack(spacing: 6) {
        Image("GrowthLogo")
          .resizable()
          .aspectRatio(contentMode: .fit)
          .frame(width: 18, height: 18)
        Text("Tareas de hoy").font(.caption.weight(.bold)).foregroundColor(.secondary)
        Spacer(minLength: 0)
        if !items.isEmpty {
          Text("\(entry.notas.count)").font(.caption.weight(.bold)).foregroundColor(brand)
        }
      }
      .padding(.horizontal, 11) // alinea con el contenido de las tarjetas

      if items.isEmpty {
        Text("¡Sin tareas pendientes! 🎉")
          .font(.footnote)
          .foregroundColor(.secondary)
          .frame(maxWidth: .infinity, alignment: .center)
      } else {
        ForEach(items, id: \.self) { FilaTarea(item: $0) }
        if entry.notas.count > items.count {
          Text("+\(entry.notas.count - items.count) más")
            .font(.caption2.weight(.semibold))
            .foregroundColor(.secondary)
            .frame(maxWidth: .infinity, alignment: .trailing)
            .padding(.horizontal, 11) // alinea con el contenido de las tarjetas
            .padding(.top, 1)
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
  }
}

struct NotasWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "NotasWidget", provider: NotasProvider()) { entry in
      if #available(iOS 17.0, *) {
        NotasWidgetEntryView(entry: entry)
          .padding(14)
          .containerBackground(.fill.tertiary, for: .widget)
      } else {
        NotasWidgetEntryView(entry: entry)
          .padding(14)
      }
    }
    .configurationDisplayName("Tareas")
    .description("Tus tareas pendientes de hoy, con el color de cada una.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    .contentMarginsDisabled()
  }
}
