#pragma strict

import System.Collections.Generic;
import System.Xml;
import System.Xml.Serialization;
import System.IO;

/*

To make this class this tutorials have been followed. There can be found examples on how to use this class and more information on these links.

http://wiki.unity3d.com/index.php?title=Saving_and_Loading_Data:_XmlSerializer

http://forum.unity3d.com/threads/85925-Saving-and-Loading-Data-XmlSerializer?p=555154

*/

public class RoundHandler{
	
	private var gameLogic : GameLogic;			//A reference to GameObject will be neccesary to show errors in the webplayer build release
	private var levelLogicQuiz : LevelLogicQuiz;
	
	private var myRound: Round;
	
	private var debugMode: boolean = true;
	
	public function RoundHandler(){
		gameLogic = GameObject.Find("GameLogic").GetComponent("GameLogic");
		levelLogicQuiz = GameObject.Find("LevelLogic").GetComponent("LevelLogicQuiz");
		if (!levelLogicQuiz) Debug.LogError("LevelLogicQuiz script not found/reachable");
	}
	
	//To load from an XML file giving its path
//	public function LoadFromPath(path : String){
//		if (debugMode) Debug.Log("RoundHandler: Loading from path. Path to load xml: " + path);		
//		
// 		var serializer : XmlSerializer = new XmlSerializer(Round);
// 		var stream : Stream = new FileStream(path, FileMode.Open);		//From the web player we cant load any file.
// 		
// 		myRound = serializer.Deserialize(stream) as Round;
// 		stream.Close();
// 		
// 		//gameLogic.ReceiveRound(myRound);		//Gives back the round to the GameLogic script once generated
// 		levelLogicQuiz.ReceiveRound(myRound);
// 	}
 
	//Loads the xml directly from the given string. Useful in combination with www.text.
	//The webplayer can't access files on any computer directly so using the methods described before to read/write data won't work here. To load any data you need to use the WWW class.
	public function LoadFromText(text : String):Round{
		if (debugMode) Debug.Log("RoundHandler: Loading from Text.");
		
		var serializer : XmlSerializer = new XmlSerializer(Round);
		if (! text || text == "") Debug.LogError("Text to parse is empty");
		var reader: StringReader = new StringReader(text);
		myRound = serializer.Deserialize(reader) as Round;
		
		//gameLogic.ReceiveRound(myRound);			//Gives back the round to the GameLogic script once generated
		//levelLogicQuiz.ReceiveRound(myRound);
		return myRound;
	}
	
	//same function than the ones above but taking a StringReader as a parameter
//	public function LoadFromStringReader(sr: StringReader): Round{
//		var serializer : XmlSerializer = new XmlSerializer(Round);
//		if(!sr) Debug.Log("LoadFromStringReader(sr)-> The given StringSerializer was null.");
//		return serializer.Deserialize(sr) as Round;
//	}
	
	//This function will return a Round object given the number of round that we want to load from 1 to 5
//	public function LoadRoundFromXMLResources(num: int){
//		
//		if (debugMode) Debug.Log("RoundHandler: Trying to get the questions from the local xml file.");
//		
//		var mypath: String = "Resources" + Path.DirectorySeparatorChar + "TextFiles" + Path.DirectorySeparatorChar + "quiz" + Path.DirectorySeparatorChar + "en_en_gameshow_round";
//		//var mypath : String = "en_en_gameshow_round";
//		if(num > 0 && num < 6){
//			if (debugMode) Debug.Log("RoundHandler: Loading xml: " + mypath + num.ToString() + ".xml");
//			mypath = mypath + num.ToString() + ".xml";
//		}else{
//			Debug.LogError("Wrong round requested. Requested number: " + num + ". Loading first round by default");
//			mypath = mypath + "1" + ".xml";
//		}
//		LoadFromPath(Path.Combine(Application.dataPath, mypath));
//	}
	
	public function LoadRoundFromWeb(num: int){
		//Asks the web server for the xml files, waits for it, and calls the LoadFromText method to parse it and give it back to the GameLogic script.
		
		if (debugMode) Debug.Log("RoundHandler: Trying to get the questions from the web server.");
		
		var mypath: String = "en_en_gameshow_round";
		//var mypath : String = "en_en_gameshow_round";
		if(num > 0 && num < 6){
			if (debugMode) Debug.Log("RoundHandler: Loading xml: " + mypath + num.ToString() + ".xml");
			mypath = mypath + num.ToString() + ".xml";
		}else{
			Debug.LogError("Wrong round requested. Requested number: " + num + ". Loading first round by defaults");
			mypath = mypath + "1" + ".xml";
		}
		//var www : WWW = new WWW(Path.Combine(Application.dataPath, mypath));		//This was written in http://wiki.unity3d.com/index.php?title=Saving_and_Loading_Data:_XmlSerializer
	    var www : WWW = new WWW("http://localhost:3030" + mypath);
	    yield www;
	    
	    if (www.error){
	    	Debug.LogError("Error when loading the quiz number "+num+" from the server! " + www.error );
	    	gameLogic.PrintError("Error when loading the quiz number "+num+" from the server!", 2);
	    }else{
	    	if (debugMode) Debug.Log("RoundHandler: Xml dialog number " + num + " received correctly from the web");
	    	LoadFromText(www.text);		//If the xml is received correctly, LoadFromText is called to process it and give it back to the GameLogic script
	    }
	    
	}
}

@XmlRoot("round")
public class Round{
//This class will be used to hold all the information of the questions and answers of each round of questions
	
	@XmlAttribute("id")
	public var id: int;
	
	public var name: String;
	public var round_id: int;
	public var next_round: String;
	public var intro_text: IntroText;
	
	@XmlArray("questions")
	@XmlArrayItem("question")
	public var questions:  List.<Question> = new List.<Question>();
	
	public function Round(){
		
	}
	
}

public class IntroText{
	
	@XmlArray("blind")				//The list is called blind in the xml
	@XmlArrayItem("statement")		//Each element is called Statement in the xml		WARNING! in some xml files (like alpha_gameshow_round1.xml) some <statement> tags are wrongly written, and this doesn't cause any error, but the message between the incorrect tags will nor be displayed!
	public var blind: List.<String> = new List.<String>();
	
	@XmlArray("normal")
	@XmlArrayItem("statement")
	public var normal:  List.<String> = new List.<String>();

}

//public class QuestionsContainer{
//	
//	@XmlArray("questions")
//	@XmlArrayItem("question")
//	public var questions:  List.<Question> = new List.<Question>();
//	
//}

public class Question{
	
	@XmlAttribute("name")
	public var id : int;
	
	public var type: int;
	public var score: int;
	public var value: int;		//value is a reserved word
	public var text: String;
	
	@XmlArray("answers")
	@XmlArrayItem("answer")
	public var answers:  List.<Answer> = new List.<Answer>();
}

public class Answer{
	
	public var label: String;
	public var value: int;
	
}