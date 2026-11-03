# Datenbanken Lerntool

Lernwerkzeug zum Modul Datenbanksysteme (3. Semester). Es gibt die **HTML-Version** zum sofortigen Lernen und die vorbereitete **iOS-App** im Aufbau der Netztechnik-App. Beide lesen dieselben Inhalte.

## HTML-Version benutzen

`../Datenbanken_Lerntool.html` per Doppelklick öffnen. Die Datei enthält alles und läuft ohne Internet. Der Lernstand liegt im Browser (`localStorage`).

| Tab | Inhalt |
| --- | --- |
| Heute | Lernstand, nächster Schritt, Klausurgewichtung |
| Lernen | 20 Module, jeder Abschnitt erst Theorie, dann Praxis |
| Wiederholen | Fällige Aufgaben und Schwächen (Spaced Repetition) |
| Trainer | Elf Aufgabentypen mit immer neuen Daten und Lösungsweg |
| Klausur | Drei Probeklausuren mit 60-Minuten-Timer |

## Gewichtung

Die Klausur 2025 nennt keine Punkte. Die Anteile in `course.json` sind aus dem Aufgabenumfang geschätzt (etwa 1 Minute = 1 Punkt):

| Aufgabe | Thema | Min. | Anteil |
| --- | --- | --- | --- |
| A1 | DBMS, Access und Excel | 4 | 7 % |
| A2 | Datenbanktypen und Aussagen | 8 | 13 % |
| A3 | ER-Diagramm in Chen-Notation | 12 | 20 % |
| A4 | Relationales Schema | 7 | 12 % |
| A5 | Division | 9 | 15 % |
| A6 | Attributhülle und kanonische Überdeckung | 10 | 17 % |
| A7 | 3NF und BCNF | 10 | 16 % |

Die Originalklausur ist bewusst nicht enthalten. `tools/validate-content.js` sucht nach Begriffen aus der Klausur und prüft jede FD-Menge, auch unter vertauschten Buchstaben, gegen die Klausurmenge.

## iOS-App vorbereiten und aufs iPhone bringen

Dafür brauchst du einen Mac mit Xcode. Auf diesem Windows-Rechner lässt sich die App nicht bauen.

1. Den Ordner `DatenbankenLernApp` auf den Mac kopieren.
2. `DatenbankenLernApp.xcodeproj` öffnen. Nötig ist **Xcode 16 oder neuer**, für echtes Liquid Glass **Xcode 26**.
3. Target *DatenbankenLernApp* → *Signing & Capabilities* → eigenes **Team** wählen. Falls die Bundle-ID belegt ist, eine eigene eintragen.
4. iPhone auswählen und starten. Mindestversion ist iOS 17.

**Stand:** Der Swift-Code wurde **noch nie kompiliert**, weil hier kein Xcode verfügbar ist. App, Modelle und Ansichten stammen zum großen Teil aus der Netztechnik-App und sind gezielt angepasst. `tools/check-swift.js` prüft, was ohne Compiler geht. Beim ersten Build können trotzdem kleine Fehler auftauchen.

### Was in der App wie läuft

| Teil | Umsetzung |
| --- | --- |
| Inhalte, Fragen, Lernstand, Klausur | nativ in SwiftUI, Schema wie bei Netztechnik |
| Aufgaben des Trainers | `engine.js` über JavaScriptCore, also dieselbe Logik wie im Browser |
| 20 Labore und Chen-Diagramme | `labs.html` in einem WKWebView (`Viz/WebLabView.swift`), einzeln nativ ersetzbar |

## Aufbau

| Ordner | Inhalt |
| --- | --- |
| `DatenbankenLernApp/Resources/Content` | **Alle Inhalte:** `module_*.json`, `course.json`, `exams.json` |
| `DatenbankenLernApp/Resources/Slides` | Zugeschnittene Folien, von `tools/extract-slides.js` erzeugt |
| `DatenbankenLernApp/Resources/PDF` | Die Skripte für „Im Skript nachsehen“ in der App |
| `DatenbankenLernApp/Resources/Web` | Von `tools/build.js` erzeugt, nicht von Hand ändern |
| `DatenbankenLernApp/App`, `Models`, `Views`, `Viz`, `Calc` | Swift-Quelltext |
| `web/src` | HTML-Version: Logik (`engine.js`), Oberfläche, Labore, Design |
| `tools` | Bauen, Prüfen, Testen |

## Inhalte ändern

Ein Modul besteht aus Abschnitten mit Theorie (`blocks`) und Praxis (`practice`, eine Liste von Fragen-IDs).

- Blocktypen (`t`): `p`, `h`, `b`, `k`, `w`, `ex`, `f`, `s`, `code`, `tb`, `rels`, `sl`, `st`, `er`, `net`, `bars`, `x`
- Fragetypen (`k`): `mc`, `ms`, `tf`, `num`, `ord`, `match`, `open`, `lab`
- Text: `**fett**`, `*kursiv*`, `` `Code` ``, `<u>Primärschlüssel</u>`, `π_{A}(R)` für tiefgestellt

Eine neue Folie ist ein Block wie `{"t":"sl","part":3,"page":15,"crop":[0,12,100,80],"x":"Beschriftung"}`, `crop` ist links, oben, Breite, Höhe in Prozent.

```
node tools/extract-slides.js      # Folien aus den PDFs schneiden (braucht Poppler)
node tools/build.js               # HTML-Datei und App-Bausteine bauen
```

## Prüfen

```
node tools/test-engines.js        # Logik gegen Folien und Übungsblätter
node tools/validate-content.js    # Inhalte, Vollständigkeit, Klausurschutz, Nachrechnen
node tools/check-swift.js         # JSON gegen Swift-Modelle, Klammern, Ressourcen, Xcode-Projekt
node tools/build.js --test        # Testvariante bauen
node tools/test-ui.js             # Alle Seiten und Labore in Edge durchklicken
```

Der Lernstand der App liegt in `Application Support/lernstand.json`. IDs von Fragen sollten sich nicht ändern, sonst geht deren Lernstand verloren.
