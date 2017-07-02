'use strict';

module.exports.hello = (event, context, callback) => {
  service.getNextWasteCollection().then((result) => {
    const response = {
      statusCode: 200,
      body: result
    };

   callback(null, response);
 });
};

const fetch = require('fetch').fetchUrl;
const cheerio = require('cheerio');
const moment = require('moment');
const aws = require('aws-sdk');

const locationId = "10033340867";

const infoPage = 'http://maps.monmouthshire.gov.uk/localinfo.aspx?action=SetAddress&UniqueId=' + locationId;

var service = {
	getNextWasteCollection: function getNextWasteCollection() {
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
						.then((result) => { service.updateCachedData(locationId, result) })
						.then(function (result) {
							resolve(result);
						});
				}

			});
		});
	},

	getCachedData: (id) => {
		return new Promise(function (resolve, reject) {
			var docClient = new aws.DynamoDB.DocumentClient();

			var params = {
				TableName : "council-api",
				KeyConditionExpression: "id = :idValue",
				ExpressionAttributeValues: {
					":idValue":id
				}
			};

			docClient.query(params, function(err, data) {
    			if (err) {
					reject(Error(err));
        			console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
    			} else {
        			resolve(JSON.parse(data.Items.pop().data));
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
			console.log(params);

			docClient.put(params, function(err, data) {
    			if (err) {
					reject(Error(err));
        			console.error("Unable to put. Error:", JSON.stringify(err, null, 2));
    			} else {
        			resolve();
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