// const { handleTurn, handleSelectedChoice } = require('./openai_script');
// const {  InteractionHistory, IssueHistory, fetchTicketInfo } = require('./cosmosDBHelper');

// module.exports = async function (context, req) {

//     context.log('JavaScript HTTP trigger function processed a request.');

//     const userMessage = req.body.description;
//     const sessionId = req.body.userId;
//     const requestType = req.body.requestType;
//     const userId = req.body.userId;
//     const optionChosen = req.body.optionChosen;
//     const filteredResponse = req.body.filteredResponse;
//     const selectedResponseTitle = req.body.selectedResponseTitle;
//     const selectedChoiceResponse = req.body.selectedChoiceResponse;
//     const satisfaction = req.body.satisfaction;
//     const uniqueId = req.body.uniqueId;

//     try {
//         let botResponse;

//         if (requestType === 'handleTurn') {
//             botResponse = await handleTurn(userMessage, sessionId);
//         } else if (requestType === 'handleChoice') {
//             botResponse = await handleSelectedChoice(userMessage, sessionId);
//         } else if (requestType === 'interactionHistory') {
//             botResponse = await InteractionHistory(userId, optionChosen, userMessage, filteredResponse, selectedResponseTitle, selectedChoiceResponse, satisfaction);
//         } else if (requestType === 'issueHistory') {
//             context.log('selectedChoiceResponse',selectedChoiceResponse);
//             botResponse = await IssueHistory(userId, userMessage, selectedChoiceResponse);
//         } else if (requestType === 'fetchTicketInfo') {
//             botResponse = await fetchTicketInfo(uniqueId);
//         } else {
//             context.res = {
//                 status: 400,
//                 body: "Invalid request type"
//             };
//             return;
//         }

//         context.res = {
//             headers: {
//                 'Access-Control-Allow-Origin': '*'
//             },
//             body: JSON.stringify({ responses: botResponse })
//         };
//     } catch (err) {
//         context.log.error('An error occurred:', err);
//         context.log.error('Error stack:', err.stack);
//         context.log.error('Error message:', err.message);

//         context.res = {
//             status: 500,
//             headers: {
//                 'Content-Type': 'application/json'
//             },
//             body: JSON.stringify({
//                 error: 'An internal server error occurred.',
//                 details: err.message
//             })
//         };
//     }
// };



































const { handleSelectedChoice } = require('../script/openai_script.js');
module.exports = async function (context, req) {

    try {
        context.log('JavaScript HTTP trigger function processed a request.');

        // Read incoming data
        const selected = (req.query.selected || (req.body && req.body.selected));

        // fail if incoming data is required
        if (!selected ) {

            context.res = {
                status: 400
            };
            return;
        }

        // Add or change code here
        const message = await handleSelectedChoice(selected);
        
        // Construct response
        const responseJSON = {
            "selectedChoice": selected,
            "result": message,
            "success": true
        }

        context.res = {
            // status: 200, /* Defaults to 200 */
            body: responseJSON,
            contentType: 'application/json'
        };
    } catch(err) {
        context.res = {
            status: 500
        };
    }
}