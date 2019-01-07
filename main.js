const fs = require('fs-extra')
const async = require('async')
const request = require('request-promise')
const scrapeIt = require('scrape-it')
const _ = require('lodash')
const pagesConcurrency = 5

const thesisUrl = {
  urls: {
    listItem: 'td.oddRowOddCol,td.evenRowOddCol',
    data: {
      url: {
        selector: 'a',
        attr: 'href',
        convert: x => 'https://apothesis.eap.gr' + x
      }
    }
  }
}

const thesisPage = {
  title: 'tr:nth-child(1) td.metadataFieldValue',
  authors: 'tr:nth-child(2) td.metadataFieldValue',
  advisor: 'tr:nth-child(3) td.metadataFieldValue',
  issueDate: 'tr:nth-child(4) td.metadataFieldValue',
  fileUrl: 'div.panel.panel-info  table  tbody  tr:nth-child(2)  td:nth-child(1) a'
}

mainProgram()
// testFunction()

function mainProgram () {

  let thesisArray = []

  for (let i = 0;i < 3;i++) {
    thesisArray.push(`https://apothesis.eap.gr/handle/repo/12645?offset=${i * 50}`)
  }

  Promise.all(thesisArray.map(url => request({ url, 'proxy': 'http://wsa.central.nbg.gr:8080' })))
    .then(res => {
      let totalBodies = res[0] + res[1] + res[2]
      let thesisUrls = scrapeIt.scrapeHTML(totalBodies, thesisUrl).urls
      // console.log(thesisUrls)
      return scrapeWithConcurrency(thesisUrls.map(el => el.url))
    })
    .then(thesisInfoArray => {
      let advisors = normalizeData(thesisInfoArray)
      fs.writeJSON('advisors.json', advisors)
      fs.writeFileSync('index.html', createSimpleVueFile(JSON.stringify(advisors)))
    })
    .then(() => console.log('All done!'))
    .catch(error => console.log(error))
}

function scrapeWithConcurrency (urlsToScrape) {
  let thesisInfoArray = []
  let urlsScraped = 0
  let totalUrls = urlsToScrape.length
  return new Promise((resolve, reject) => {
    let q = async.queue(function (url, callback) {
      request({ url, 'proxy': 'http://wsa.central.nbg.gr:8080' })
        .then(srapedPage => {
          urlsScraped++
          fs.writeFileSync('thesis.html', srapedPage)
          console.log(`${urlsScraped}/${totalUrls}`)
          let thesisInfo = scrapeIt.scrapeHTML(srapedPage, thesisPage)
          thesisInfo.url = url
          // console.log(thesisInfo)
          thesisInfoArray.push(thesisInfo)
        })
        .then(() => {
          callback()
        })
        .catch(error => console.log(error))
    }, pagesConcurrency)

    q.push(urlsToScrape, function (err) {
      if (err) console.log(`q.push: ${err}`)
    })

    q.drain = function () {
      resolve(thesisInfoArray)
    }
  })
}

function createSimpleVueFile (advisors) {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>All SDY thesis</title>
  <script src='https://unpkg.com/vue'></script>
  <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.1.3/css/bootstrap.min.css">
</head>
<body>
<div id='app'>
  <div class="container-fluid">
    <div class="row">
      <div class="offset-md-2 col-md-8">
        <h1>ΣΔΥ: Όλες οι διπλωματικές</h1>
        <div v-for='advisor in advisors'>
          <hr>
          <h2>{{advisor.name}}</h2>
          <span>Number Of Theses: {{advisor.numOfTheses}}</span>
          <ol>
            <li v-for="thesis in advisor.theses">
              <a :href="thesis.url">{{thesis.title}}</a>- {{thesis.authors}}
            </li>
          </ol>
        </div>
      </div>
    </div>
  </div>
</div>
  <script>
    var app = new Vue({
      el: '#app',
      data: {
        advisors: ${advisors}
      },
      methods: {
      }
    })
  </script>
</body>
</html>
`
}

function normalizeData (data) {
  // const data = require('./thesisInfoArray.json')
  // https://apothesis.eap.gr/handle/repo/26577
  // https://apothesis.eap.gr/handle/repo/26579
  // are zip
  data.forEach(el => {
    if (el.url === "https://apothesis.eap.gr/handle/repo/26319") el.advisor = 'noAdvisor'
    if (el.url === 'https://apothesis.eap.gr/handle/repo/36865') {
      el.advisor = 'Παλαιγεωργίου, Γεώργιος'
    }
    if (el.url === 'https://apothesis.eap.gr/handle/repo/35887') {
      el.advisor = 'Καμέας, Αχιλλέας'
    }
    if (el.url === 'https://apothesis.eap.gr/handle/repo/32170') {
      el.advisor = 'Μαγκλογιάννης, Ηλίας'
    }
    if (el.url === 'https://apothesis.eap.gr/handle/repo/26578' ||
      el.url === 'https://apothesis.eap.gr/handle/repo/26318'
    ) {
      el.advisor = 'Γαβαλάς, Δαμιανός'
    }
    if (el.url === 'https://apothesis.eap.gr/handle/repo/32148') {
      el.advisor = 'Παλαιγεωργίου, Γεώργιος'
    }
    if (el.url === 'https://apothesis.eap.gr/handle/repo/33741') {
      el.advisor = 'Γκουμόπουλος, Χρήστος'
    }
    if (el.url === 'https://apothesis.eap.gr/handle/repo/26317') {
      el.advisor = 'Χωριανόπουλος, Κωνσταντίνος'
    }

    if (el.advisor === 'Kameas, Achilles' ||
      el.advisor === 'ΚΑΜΕΑΣ, ΑΧΙΛΛΕΑΣ'
    ) el.advisor = 'Καμέας, Αχιλλέας'
    if (el.advisor === 'ΓΚΟΥΜΟΠΟΥΛΟΣ ΧΡΗΣΤΟΣ' ||
      el.advisor === 'ΓΚΟΥΜΟΠΟΥΛΟΣ, ΧΡΗΣΤΟΣ' ||
      el.advisor === 'Γκουμόπουλος, Χρήστος Δρ' ||
      el.advisor === 'Goumopoulos, Christos'
    ) el.advisor = 'Γκουμόπουλος, Χρήστος'
    if (el.advisor === 'Psannis, Konstantinos' ||
      el.advisor === 'ΨΑΝΝΗΣ, ΚΩΝΣΤΑΝΤΙΝΟΣ'
    ) el.advisor = 'Ψάννης, Κωνσταντίνος'
    if (el.advisor === 'ΧΑΤΖΗΜΙΣΙΟΣ ΠΕΡΙΚΛΗΣ' ||
      el.advisor === 'Χατζημίσιος , Περικλής' ||
      el.advisor === 'Chatzimisios, Periklis'
    ) el.advisor = 'Χατζημίσιος, Περικλής'
    if (el.advisor === 'ΝΙΚΟΠΟΛΙΤΙΔΗΣ, ΠΕΤΡΟΣ' ||
      el.advisor === 'ΝΙΚΟΠΟΛΙΤΙΔΗΣ, Πέτρος'
    ) el.advisor = 'Νικοπολιτίδης, Πέτρος'
    if (el.advisor === 'ΧΩΡΙΑΝΟΠΟΥΛΟΣ, ΚΩΝΣΤΑΝΤΙΝΟΣ' ||
      el.advisor === 'ΧΩΡΙΑΝΟΠΟΥΛΟΣ ΚΩΝΣΤΑΝΤΙΝΟΣ'
    ) el.advisor = 'Χωριανόπουλος, Κωνσταντίνος'
    if (el.advisor === 'ΚΟΜΝΗΝΟΣ ΑΝΔΡΕΑΣ' ||
      el.advisor === 'ΚΟΜΝΗΝΟΣ, ΑΝΔΡΕΑΣ'
    ) el.advisor = 'Κομνηνός, Ανδρέας'
    if (el.advisor === 'Βασίλης Κουτκιάς, Ερευνητής Ινστιτούτο Εφαρμοσμένων Βιοεπιστημών, Εθνικό Κέντρο Έρευνας & Τεχνολογικής Ανάπτυξης' ||
      el.advisor === 'ΚΟΥΤΚΙΑΣ ΒΑΣΙΛΕΙΟΣ'
    ) el.advisor = 'Κουτκιάς, Βασίλειος'
    if (el.advisor === 'ΚΙΤΣΟΣ, ΠΑΡΑΣΚΕΥΑΣ' ||
      el.advisor === 'ΚΙΤΣΟΣ, ΠΑΡΑΣΚΕΥΑΣ' ||
      el.advisor === 'ΚΙΤΣΟΣ ΠΑΡΑΣΚΕΥΑΣ'
    ) el.advisor = 'Κίτσος, Παρασκευάς'
    if (el.advisor === 'ΣΤΡΑΤΟΓΙΑΝΝΗΣ, ΔΗΜΗΤΡΙΟΣ'
    ) el.advisor = 'Στρατογιάννης, Δημήτριος'
    if (el.advisor === 'ΡΙΖΟΠΟΥΛΟΣ, ΧΑΡΑΛΑΜΠΟΣ' ||
      el.advisor === 'Rizopoulos, Charalampos'
    ) el.advisor = 'Ριζόπουλος, Χαράλαμπος'
    if (el.advisor === 'Adamopoulou, Evgenia' ||
      el.advisor === 'ΑΔΑΜΟΠΟΥΛΟΥ ΕΥΓΕΝΙΑ'
    ) el.advisor = 'Αδαμοπούλου, Ευγενία'
    if (el.advisor === 'Μαγκλογιάννης, Ηλίας, Αναπληρωτής Καθηγητής' ||
      el.advisor === 'ΜΑΓΚΛΟΓΙΑΝΝΗΣ ΗΛΙΑΣ' ||
      el.advisor === 'ΜΑΓΚΛΟΓΙΑΝΝΗΣ, ΗΛΙΑΣ'
    ) el.advisor = 'Μαγκλογιάννης, Ηλίας'
    if (el.advisor === 'ΓΕΩΡΓΙΑΔΗΣ ΧΡΗΣΤΟΣ' ||
      el.advisor === 'ΓΕΩΡΓΙΑΔΗΣ, ΧΡΗΣΤΟΣ'
    ) el.advisor = 'Γεωργιάδης, Χρήστος'
    if (el.advisor === 'Παλαιγεωργίου, Δρ. Γεώργιος' ||
      el.advisor === 'ΠΑΛΑΙΓΕΩΡΓΙΟΥ ΓΕΩΡΓΙΟΣ'
    ) el.advisor = 'Παλαιγεωργίου, Γεώργιος'
    if (el.advisor === 'Ζαχαράκης, Ιωάννης Δ.' ||
      el.advisor === 'ΖΑΧΑΡΑΚΗΣ ΙΩΑΝΝΗΣ'
    ) el.advisor = 'Ζαχαράκης, Ιωάννης'
    if (el.advisor === 'ΦΟΥΛΗΡΑΣ, ΠΑΝΑΓΙΩΤΗΣ'
    ) el.advisor = 'Φουληράς, Παναγιώτης'
    if (el.advisor === 'ΓΑΒΑΛΑΣ ΔΑΜΙΑΝΟΣ'
    ) el.advisor = 'Γαβαλάς, Δαμιανός'
    if (el.advisor === 'ΜΑΥΡΙΔΗΣ ΙΩΑΝΝΗΣ'
    ) el.advisor = 'Μαυρίδης, Ιωάννης'
    // if (el.advisor === '22-Oct-2014' || el.advisor === '16-Oct-2013') console.log(el.url)
  })

  //   https://apothesis.eap.gr/handle/repo/26578
  // 'ΓΑΒΑΛΑΣ ΔΑΜΙΑΝΟΣ': 4,
  // 'Γαβαλάς, Δαμιανός': 3,

  // var result = _.countBy(data, 'advisor');
  // // console.log(result)
  let grouped = _(data).groupBy(b => b.advisor)
    .map((value, key) => ({ name: key, theses: value, numOfTheses: value.length }))
    .value()

  grouped = grouped.sort((a, b) => b.numOfTheses - a.numOfTheses)
  // console.log(grouped)
  return grouped
}
