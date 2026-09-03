# SmartKorb Wien — Datenformat für Aktionsdaten

<!-- Written in German on purpose: this document is meant to be handed to an
     Austrian retail partner. Everything else in the repository is English. -->

Dieses Dokument beschreibt, in welchem Format SmartKorb Wien wöchentliche bzw.
tägliche Aktionsdaten einer Handelskette entgegennimmt. Es ist bewusst einfach
gehalten: eine CSV-Datei, die aus jedem Warenwirtschaftssystem exportiert werden
kann.

## Lieferung

- **Format:** CSV, UTF-8 kodiert
- **Trennzeichen:** `,` oder `;` (wird automatisch erkannt)
- **Textbegrenzer:** `"` — verpflichtend für Felder, die das Trennzeichen oder
  ein Komma im Preis bzw. im Produktnamen enthalten
- **Erste Zeile:** Spaltenüberschriften (Reihenfolge beliebig)
- **Rhythmus:** täglich bis 05:00 Uhr, oder wöchentlich zum Start des
  Aktionszeitraums
- **Übermittlung:** abrufbare URL, SFTP oder E-Mail-Anhang — die Datei wird als
  `data/partner-feed.csv` in die tägliche Aktualisierung übernommen

## Spalten

| Spalte | Pflicht | Beispiel | Bedeutung |
| --- | --- | --- | --- |
| `retailerId` | ja | `billa` | Kette: `spar`, `billa`, `billaplus`, `hofer`, `lidl`, `penny` |
| `productName` | ja | `Rispentomaten` | Produktbezeichnung wie im Aktionsblatt |
| `originalPrice` | ja | `2.49` | regulärer Verkaufspreis in EUR (Punkt oder Komma) |
| `discountPrice` | ja | `1.49` | Aktionspreis in EUR, muss kleiner als `originalPrice` sein |
| `unit` | empfohlen | `500 g` | Gebindegröße: `500 g`, `1,5 l`, `6 Stk`, `3 x 80 g` |
| `category` | empfohlen | `Obst & Gemüse` | Warengruppe; verbessert die Zuordnung |
| `validFrom` | empfohlen | `2026-09-01` | Beginn des Aktionszeitraums (ISO-Datum) |
| `validTo` | empfohlen | `2026-09-07` | letzter Gültigkeitstag (ISO-Datum, inklusive) |
| `storeExternalId` | optional | *(leer)* | **leer = Aktion gilt in allen Filialen.** Nur befüllen, wenn die Aktion auf eine Filiale beschränkt ist |
| `sourceUrl` | optional | `https://…/aktion/123` | Link auf die Aktion, wird in der App verlinkt |

Nicht benötigt werden: Lagerbestände, Einkaufspreise, Margen, Kundendaten. Es
werden ausschließlich Aktionspreise verarbeitet, keine personenbezogenen Daten.

## Beispiel

```csv
retailerId,productName,unit,category,originalPrice,discountPrice,validFrom,validTo,storeExternalId,sourceUrl
billa,Rispentomaten,500 g,Obst & Gemüse,2.49,1.49,2026-09-01,2026-09-07,,https://example.at/aktion/1
billa,"Bio-Vollmilch 3,5 %",1 l,Milchprodukte,1.79,1.29,2026-09-01,2026-09-07,,
spar,SPAR Premium Hühnerbrustfilet,500 g,Fleisch & Fisch,7.99,4.99,2026-09-02,2026-09-08,,
```

Eine lauffähige Beispieldatei liegt unter `data/partner-feed.example.csv`.

## Prüfung einer Lieferung

```bash
npm run feed:check -- data/partner-feed.csv
```

Der Report zeigt, wie viele Zeilen übernommen werden, wie viele davon einem
bereits bekannten Produkt zugeordnet werden konnten und welche Zeilen aus
welchem Grund verworfen wurden (unplausible Preise, unbekannte Kette,
Duplikate). Erst wenn dieser Report passt, sollte der Feed in die tägliche
Aktualisierung übernommen werden.

## Was mit den Daten passiert

1. Produktnamen werden dem internen Produktkatalog zugeordnet — Markenpräfixe
   wie „SPAR Premium …“ oder „Zurück zum Ursprung …“ stören dabei nicht.
2. Gebindegrößen werden in Gramm/Milliliter umgerechnet, damit Rezeptmengen und
   Portionspreise berechnet werden können.
3. Der Rabattprozentsatz wird immer aus den beiden Preisen berechnet, nie
   übernommen.
4. Das Ergebnis wird validiert und einmal täglich als Datenstand veröffentlicht,
   den die App lädt.
