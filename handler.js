'use strict';

module.exports.hello = (event, context, callback) => {

  service.getNextWasteCollection().then((result) => {
    const response = {
      statusCode: 200,
      body: JSON.stringify(result),
    };

    callback(null, response);
  });
};

const fetch = require('fetch').fetchUrl;
const cheerio = require('cheerio');
const moment = require('moment');

const infoPage = 'http://maps.monmouthshire.gov.uk/localinfo.aspx?action=SetAddress&UniqueId=10033340867';

var service = {
	getNextWasteCollection: function getTextResponse() {
		return new Promise(function (resolve, reject) {
			service.getPage(infoPage)
				.then(service.getModel)
				.then(function (result) {
					resolve(result);
				})
		});
	},

	getPage: function getPage(url) {
		return new Promise(function (resolve, reject) {
			console.log('Getting content from ' + url);
			fetch(url,
				function (error, meta, body) {
					if (!error) {
						console.log('Got content from ' + url);
						resolve(body);
					} else {
						console.log('Error getting content from ' + url + ': ' + error);
						reject(Error(error))
					}
				});
		});
	},

	getModel: function getModel(html) {
		return new Promise((resolve, reject) => {
			const $ = cheerio.load(html);

			var model = {
				collections: []
			}

			const temp = $(".waste").each((index, element)=>{
				
				var collection = $(element).children('h4').text();
				var date = $(element).children('p').first().children('strong').first().text();
				var parsedDate = date != "" ? moment(date, "dddd DD MMMM").unix() : "";

				model.collections.push(
					{
						collectionType: collection, 
						textDate: date,
						parsedDate: parsedDate
					}
				);
			});

			//Sort model
			model.collections.sort((a, b) => {
				if (a.parsedDate < b.parsedDate) return -1;
				if (a.parsedDate > b.parsedDate) return 1;
				return 0;
			})
      
			resolve(model);
		});
	},
};