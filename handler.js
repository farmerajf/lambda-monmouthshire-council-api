'use strict';

module.exports.getWasteCollections = (event, context, callback) => {
  service.getWasteCollections().then((result) => {
    const response = {
      statusCode: 200,
      body: JSON.stringify(result)
    };

   callback(null, response);
 });
};

//Imports
const fetch = require('fetch').fetchUrl;
const cheerio = require('cheerio');
const moment = require('moment');
const aws = require('aws-sdk');

//The website ID for the location to search
const locationId = "10033340867";
//The URL to get the data from
const infoPage = 'http://maps.monmouthshire.gov.uk/localinfo.aspx?action=SetAddress&UniqueId=' + locationId;

//An object encapsulating the functions for the api
var service = {
	getWasteCollections: () => {
		return new Promise(function (resolve, reject) {
			service.getCachedData(locationId).then((data) => {
				var currentTime = new Date().getTime();
				var lastUpdated = data.lastUpdated;
				var cachePeriodSeconds = 86400;

				if ((lastUpdated + (cachePeriodSeconds * 1000)) > currentTime) {
					resolve(data);
				} else {
					service.getPage(infoPage)
						.then(service.getModel)
						.then(result => service.updateCachedData(locationId, result))
						.then(result => console.log(result))
						.then((result) => {
							resolve(result);
						});
				}
			});
		});
	},

	getCachedData: (id) => {
		return new Promise(function (resolve, reject) {
			var docClient = new aws.DynamoDB();
			
			var params = {
				TableName : "council-api",
				Key: {
					"id": { S: id}
				}
			};

			docClient.getItem(params, function(err, result) {
    			if (err) {
					reject(Error(err));
        			console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
    			} else {
					if (result.Item === undefined) {
						resolve({});
					} else {
        				resolve(JSON.parse(result.Item.data.S));
					}
    			}
			});
		});
	},

	updateCachedData: function updateCachedData(id, data) {
		return new Promise(function (resolve, reject) {
			var docClient = new aws.DynamoDB.DocumentClient();

			var params = {
				TableName : "council-api",
				Item : { "id": id, "data": JSON.stringify(data)}
			};

			docClient.put(params, function(err, response) {
    			if (err) {
					reject(Error(err));
        			console.error("Unable to put. Error:", JSON.stringify(err, null, 2));
    			} else {
        			resolve(data);
    			}
			});
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
				lastUpdated: new Date().getTime(),
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