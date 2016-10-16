var keys = require('./keys');

var request = require('request');
var Botkit = require('botkit');

var gcloud = require('google-cloud');
var vision = gcloud.vision({
  projectId: 'fir-sample-db344',
  keyFilename: __dirname + '/configgooglecloud.json'
});

var controller = Botkit.facebookbot({
  debug: true,
  access_token: keys.appToken,
  verify_token: keys.token,
});

var bot = controller.spawn({});

controller.setupWebserver(process.env.port || 3000, function(err, webserver) {
  controller.createWebhookEndpoints(webserver, bot, function() {
    console.log('Estamos Online :)');

  });
});

controller.hears(['hola', 'hi', 'hello'], 'message_received', function(bot, message) {
  controller.storage.users.get(message.user, function(err, user) {
    if (user && user.name) {
      bot.reply(message, '¡Hola ' + user.name + '!');
    } else {
      bot.reply(message, 'Hola.');
    }
  });
});

controller.hears(['llamame (.*)', 'mi nombre es (.*)'], 'message_received', function(bot, message) {
  var name = message.match[1];
  controller.storage.users.get(message.user, function(err, user) {
    if (!user) {
      user = {
        id: message.user,
      };
    }
    user.name = name;
    controller.storage.users.save(user, function(err, id) {
      bot.reply(message, 'Te llamaré ' + user.name + ' desde ahora.');
    });
  });
});

controller.hears(['cual es mi nombre', 'quien soy'], 'message_received', function(bot, message) {
  controller.storage.users.get(message.user, function(err, user) {
    if (user && user.name) {
      bot.reply(message, 'Tu nombre es ' + user.name);
    } else {
      bot.startConversation(message, function(err, convo) {
        if (!err) {
          convo.say('¡No te conozco todavía!');
          convo.ask('¿Como te llamo?', function(response, convo) {
            convo.ask('Quieres que te llame `' + response.text + '`?', [{
              pattern: 'yes',
              callback: function(response, convo) {
                // since no further messages are queued after this,
                // the conversation will end naturally with status == 'completed'
                convo.next();
              }
            }, {
              pattern: 'no',
              callback: function(response, convo) {
                // stop the conversation. this will cause it to end with status == 'stopped'
                convo.stop();
              }
            }, {
              default: true,
              callback: function(response, convo) {
                convo.repeat();
                convo.next();
              }
            }]);

            convo.next();

          }, {
            'key': 'nickname'
          }); // store the results in a field called nickname

          convo.on('end', function(convo) {
            if (convo.status == 'completed') {
              bot.reply(message, 'OK! Voy a actualizar mi db...');

              controller.storage.users.get(message.user, function(err, user) {
                if (!user) {
                  user = {
                    id: message.user,
                  };
                }
                user.name = convo.extractResponse('nickname');
                controller.storage.users.save(user, function(err, id) {
                  bot.reply(message, 'Genial, te llamare ' + user.name + ' desde ahora.');
                });
              });



            } else {
              // this happens if the conversation ended prematurely for some reason
              bot.reply(message, 'OK, no importa!');
            }
          });
        }
      });
    }
  });
});


controller.hears(['structured'], 'message_received', function(bot, message) {

  bot.startConversation(message, function(err, convo) {
    convo.ask({
      attachment: {
        'type': 'template',
        'payload': {
          'template_type': 'generic',
          'elements': [{
            'title': 'Classic White T-Shirt',
            'image_url': 'http://petersapparel.parseapp.com/img/item100-thumb.png',
            'subtitle': 'Soft white cotton t-shirt is back in style',
            'buttons': [{
              'type': 'web_url',
              'url': 'https://petersapparel.parseapp.com/view_item?item_id=100',
              'title': 'View Item'
            }, {
              'type': 'web_url',
              'url': 'https://petersapparel.parseapp.com/buy_item?item_id=100',
              'title': 'Buy Item'
            }, {
              'type': 'postback',
              'title': 'Bookmark Item',
              'payload': 'White T-Shirt'
            }]
          }, {
            'title': 'Classic Grey T-Shirt',
            'image_url': 'http://petersapparel.parseapp.com/img/item101-thumb.png',
            'subtitle': 'Soft gray cotton t-shirt is back in style',
            'buttons': [{
              'type': 'web_url',
              'url': 'https://petersapparel.parseapp.com/view_item?item_id=101',
              'title': 'View Item'
            }, {
              'type': 'web_url',
              'url': 'https://petersapparel.parseapp.com/buy_item?item_id=101',
              'title': 'Buy Item'
            }, {
              'type': 'postback',
              'title': 'Bookmark Item',
              'payload': 'Grey T-Shirt'
            }]
          }]
        }
      }
    }, function(response, convo) {
      // whoa, I got the postback payload as a response to my convo.ask!
      convo.next();
    });
  });
});

controller.hears(['clima', 'tiempo', 'temperatura'], 'message_received', function(bot, message) {
  getWeather(function(temperature) {
    bot.reply(message, 'La temperatura es: ' + temperature);
  });
});

controller.hears(['lugares'], 'message_received', function(bot, message) {
  getPlaces(-16.491202, -68.205419, function(response) {
    // getPlaces(0.0, 0.0, function(response) {

    if (response.results.length > 0) {

      var aa = {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            elements: []
          }
        }
      };

      response.results.forEach(function(place, index) {
        console.log('Name: ' + place.name + index);

        var imageUrl = '';
        if (place.hasOwnProperty('photos')) {
          imageUrl = ' https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=' + place.photos[0].photo_reference + '&key=AIzaSyALtPleWL_XEknjrt9QfM3Mmi2ahvSkwmw';
        }

        if (index < 10) {
          aa.attachment.payload['elements'].push({
            title: place.name,
            subtitle: 'esta es una desc',
            item_url: 'http://alvarez.tech',
            image_url: imageUrl,
            buttons: [{
              type: 'web_url',
              url: 'http://alvarez.tech/cursos',
              title: 'Mi boton'
            }]
          });
        }
      });

      console.log("Places Response: %j", aa);

      bot.reply(message, aa);
    } else {
      bot.reply(message, 'No hay lugares aqui');
    }
  });
});


controller.on('message_received', function(bot, message) {
  console.log("Mensaje: %j", message);

  if (message.attachments) {
    var attachment = message.attachments[0];
    if (attachment.type === 'image') {
      bot.reply(message, 'nos llego una imagen');

      var imageUrl = attachment.payload.url;

      vision.detectLabels(imageUrl, function(err, labels, apiResponse) {
        if (!err) {
          console.log('%j', labels);
          bot.reply(message, labels.toString());

          translate(labels.toString(), function(response) {
            var text = response.data.translations[0].translatedText;
            bot.reply(message, 'Te lo traduci: ' + text);
          });

        } else {
          console.log(err);
          bot.reply(message, 'Algo salió mal con su imagen');
        }
      });

    } else if (attachment.type === 'location') {
      bot.reply(message, 'Nos llego una ubicación');
    } else if (attachment.type === 'file') {
      bot.reply(message, 'Nos llego un archivo, no se para que, pero llegó');
    } else {
      bot.reply(message, 'No entiendo lo que dices :(');
    }
  }

  return false;
});


function getWeather(callback) {
  request('http://api.geonames.org/findNearByWeatherJSON?lat=-16.502337&lng=-68.130914&username=alvarez', function(error, res, data) {
    if (error) {
      console.log("Error en petición: " + error);
    } else {
      var response = JSON.parse(data);
      var temperature = response.weatherObservation.temperature;
      callback(temperature);
    }
  });
}

function getPlaces(latitude, longitude, callback) {
  var url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=' + latitude + ',' + longitude + '&radius=500&key=' + keys.googlePlacesKey;

  request(url, function(error, res, data) {
    if (error) {
      console.log(error);
    } else {
      var response = JSON.parse(data);
      console.log("Places: %j", response);
      callback(response);
    }
  });
}

function translate(text, callback) {
  var url = 'https://www.googleapis.com/language/translate/v2?key=' + keys.googleTranslateKey + '&q=' + text + '&source=en&target=es';

  request(url, function(error, res, data) {
    if (error) {
      console.log(error);
    } else {
      var response = JSON.parse(data);
      console.log("Translate response: %j", response);
      callback(response);
    }
  });

}
