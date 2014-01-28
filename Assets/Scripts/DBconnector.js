#pragma strict

//Imports
import Boomlagoon.JSON;
//import UnityEngine;

//var port: int;

function Start () {
		
	}
	
function Update () {
	
	}

static var url: String = "http://localhost:3030";

private static var sessionkey: String = 'empty';

@HideInInspector
static var connected: boolean = false;			//This variable should be checked after connecting with 
	
/**
*	userID: the UserId of the database document usersession {session, userId, ip}
*	session: The session in which we are playing the game. Will be part of the url when trying to connect to the server. byte
*            This session has to exist in the server in order to establish the connection.
*	
*/
static function ConnectToGleaner (userID: String, session: String){//: Object{
	
	if (PlayerPrefs.HasKey("sessionKey")) PlayerPrefs.DeleteKey("sessionKey");		//just to be sure
	
	/*Creating the heades for the http get request*/
	var headers = new Hashtable();
	headers.Add("Authorization", userID);
	
	/*Sending the request*/
	//Debug.Log('DBConnector.EstablishConnection() -> Beginning connection...');
	var www = new WWW(url + "/start/"+session, null, headers);
	yield www;
	
	/*Dealing with the response*/
	if (!String.IsNullOrEmpty(www.error))
        Debug.Log('DBConnector.EstablishConnection() -> Error in the http response' + www.error);
    else{
    	if (www.text){
        	var resJSON : JSONObject = JSONObject.Parse(www.text);					//resJSON should contain the parsed JSON if there hasn't been errors
        	//Debug.Log('DBConnector.EstablishConnection() -> Connection established');
        	if (resJSON.ContainsKey('sessionKey')){
        		
        		sessionkey = resJSON.GetValue('sessionKey').ToString();
        		
        		var lastin = sessionkey.LastIndexOf('"');        		
        		sessionkey = sessionkey.Substring(1, lastin-1);
               		
        		PlayerPrefs.SetString("sessionKey", sessionkey);					//Stores the session key in PlayerPrefs (See http://docs.unity3d.com/Documentation/ScriptReference/PlayerPrefs.html)
        		connected = true;													//Change connected so we won't try to connect again if the sessionkey was already generated
        		//Debug.Log('DBConnector.EstablishConnection() -> sessionkey: ' + sessionkey);
        	}
			//Debug.Log("DBConnector.EstablishConnection() -> Text returned by " + url+ "/start/"+session + ": \n" + www.text);
			//Debug.Log('DBConnector.EstablishConnection() -> Text returned by the JSONObject (after Parsing and Stringifying it):\n' + resJSON.ToString());
		}
		else{
			Debug.Log('DBConnector.EstablishConnection() -> The www response was received, but did not have \'text\' field.');
		}
	}

	
}

/**
*	myTracks: Note that this is a built-in .NET array (more info -> http://docs.unity3d.com/Documentation/ScriptReference/Array.html) and 
*		must be built this way: var myArray : JSONObject[] = new JSONObject[10]; //being 10 the size of the array.
*	
*/
static function Track (myTracks: JSONObject[]){
	
	if(PlayerPrefs.HasKey("sessionKey")){
		
		Debug.Log('DBConnector.Track() -> Beginning connection with ' + url + '/track with this sessionKey: ' + PlayerPrefs.GetString("sessionKey"));
		
	/*   Setting the headers of the http post request...   */
		var headers = new Hashtable();
		headers.Add("Authorization", PlayerPrefs.GetString("sessionKey"));
		headers.Add("Content-type", "application/json");
		
	/*   Building the string to send ---> [track1, track2, ..., trackn]   */
		var stringToSend: String; // = '[' + myTrack.ToString() + ']'
		var first: boolean = true; 
		
		//ISO 8601 date format example: 1994-11-05T13:15:30.503Z (Z is to designate UTC Hour and T is to separate the time and the date) 
		var theTime = System.DateTime.UtcNow.ToString("hh:mm:ss.fff");
		var theDate = System.DateTime.UtcNow.ToString("yyy-MM-dd");
		var mydate : String = theDate + 'T' + theTime + 'Z';
		Debug.Log('Date --> '+ mydate);
		
		for (var track: JSONObject in myTracks){
			//Adding timestamp to the package...
			track.Add("timestamp", mydate);

			if (!first) 
				stringToSend = stringToSend + ',' + track.ToString();
			else{
				first = false;
				stringToSend = track.ToString();
			}	
		}
		stringToSend = '[' + stringToSend + ']';
		
	/*   to convert the string to byte[], that is what WWW() function needs as data (second argument).   */
		var encoding = new System.Text.UTF8Encoding();
		var dataToSend = encoding.GetBytes(stringToSend);		
		
		//Debug.Log('DBConnector.Track() -> this is the header: ' + headers.ToString());
		
		Debug.Log('DBConnector.Track() -> This is the string to send: ' + stringToSend);
		
	/*   Sending the http post   */
		var www = new WWW(url + "/track", dataToSend, headers);
		yield www;
		
	/*   Dealing with the response   */
		if (!String.IsNullOrEmpty(www.error))
	        Debug.Log('DBConnector.Track() -> ' + www.error);
	    else{
	    	Debug.Log('DBConnector.Track() -> Response processed without errors.\nHeaders: ' + www.responseHeaders.ToString());
	    }
	}
	else{
		Debug.Log('DBConnector.Track() -> sessionKey not found on the game!\nTry connecting to the server again.');
	}

}
/*
	The purpose of this function is to get from the server the text for the round of questions (quiz game) number NumRound
	Parameters: 
		NumRound: int; 
	Returns: A Round object containing the questions of the specified level
*/
//static function GetRound(NumRound: int): Round{
//	
//	if(PlayerPrefs.HasKey("sessionKey")){
//		
//		Debug.Log('DBConnector.GetRound() -> Beginning connection with ' + url + '/getround with this sessionKey: ' + PlayerPrefs.GetString("sessionKey"));
//		
//	/*   Setting the headers of the http post request...   */
//		var headers = new Hashtable();
//		headers.Add("Authorization", PlayerPrefs.GetString("sessionKey"));
//		headers.Add("Content-type", "application/json");
//		
//	/*   Building the string to send ---> [track1]   */
//		//In this case the track will inform to the fdatabase that the player is about to start the quiz level number "NumRound"
//		
//		//ISO 8601 date format example: 1994-11-05T13:15:30.503Z (Z is to designate UTC Hour and T is to separate the time and the date) 
//		var theTime = System.DateTime.UtcNow.ToString("hh:mm:ss.fff");
//		var theDate = System.DateTime.UtcNow.ToString("yyy-MM-dd");
//		var mydate : String = theDate + 'T' + theTime + 'Z';
//		//Debug.Log('Date --> '+ mydate);
//		
//
//		//Adding timestamp to the package...
//		var firstTrack: JSONObject = new JSONObject();	//Sending the track to the database..
//		firstTrack.Add("type", "logic");
//		firstTrack.Add("event", "Loading quiz level number " + NumRound);
//		firstTrack.Add("round", NumRound.ToString());									//To tell the server which track we are asking for
//		firstTrack.Add("timestamp", mydate);
//		var stringToSend: String = '[' + firstTrack.ToString() + ']';	
//		
//	/*   to convert the string to byte[], that is what WWW() function needs as data (second argument).   */
//		var encoding = new System.Text.UTF8Encoding();
//		var dataToSend = encoding.GetBytes(stringToSend);
//		
//		Debug.Log('DBConnector.GetRound() -> This is the string to send: ' + stringToSend);
//		
//	/*   Sending the http post   */
//		var www = new WWW(url + "/getround", dataToSend, headers);
//		while (!www.isDone);		//Blocking waiting until the request is completed
//		
//	/*   Dealing with the response   */
//		if (!String.IsNullOrEmpty(www.error))
//	        Debug.Log('DBConnector.GetRound() -> ' + www.error);
//	    else{
//	    	Debug.Log('DBConnector.GetRound() -> Response processed without errors.\nHeaders: ' + www.responseHeaders.ToString());
//	    	//Format the text receiver if any.
//	    	if (www.text){
//	        	var resJSON : JSONObject = JSONObject.Parse(www.text);					//resJSON should contain the parsed JSON if there hasn't been errors
//	        	if (resJSON.ContainsKey('round')){
//	        		
//	        		var xmltext: String = resJSON.GetValue('round').ToString();
//	        		Debug.Log("DBConnector.GetRound() -> Text received. Here's the full text: " + xmltext/*.Substring(1, 30)*/);
//	        		/*There was an error when parsing the xml text because of the BOM (byte order mark) that is at the beginning of the text. To skip it I found this solution in the following forum:
//	        		http://answers.unity3d.com/questions/10904/xmlexception-text-node-canot-appear-in-this-state.html*/
//	        		var stringReader : System.IO.StringReader = new System.IO.StringReader(xmltext);
//					stringReader.Read(); // skip BOM
//					//System.Xml.XmlReader reader = System.Xml.XmlReader.Create(stringReader);
//					
//					var roundLoaded : Round = Round.LoadFromStringReader(stringReader);
//	        		
//	        		return roundLoaded;
////	        		var lastin = sessionkey.LastIndexOf('"');        		
////	        		sessionkey = sessionkey.Substring(1, lastin-1);
////	               		
////	        		PlayerPrefs.SetString("sessionKey", sessionkey);					//Stores the session key in PlayerPrefs (See http://docs.unity3d.com/Documentation/ScriptReference/PlayerPrefs.html)
////	        		connected = true;													//Change connected so we won't try to connect again if the sessionkey was already generated
//	        		//Debug.Log('DBConnector.EstablishConnection() -> sessionkey: ' + sessionkey);
//	        	}
//				//Debug.Log("DBConnector.EstablishConnection() -> Text returned by " + url+ "/start/"+session + ": \n" + www.text);
//				//Debug.Log('DBConnector.EstablishConnection() -> Text returned by the JSONObject (after Parsing and Stringifying it):\n' + resJSON.ToString());
//			}
//			else{
//				Debug.Log('DBConnector.GetRound() -> The www response was received, but did not have \'text\' field.');
//			}
//	    }
//	}
//	else{
//		Debug.Log('DBConnector.GetRound() -> sessionKey not found on the game!\nTry connecting to the server again.');
//	}
//	
//}