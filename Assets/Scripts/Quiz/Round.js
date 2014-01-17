#pragma strict

import System.Collections.Generic;
import System.Xml;
import System.Xml.Serialization;
import System.IO;

/*

To make this class it has been followed this tutorials. There can be found examples on how to use this class and more information on this links.

http://wiki.unity3d.com/index.php?title=Saving_and_Loading_Data:_XmlSerializer

http://forum.unity3d.com/threads/85925-Saving-and-Loading-Data-XmlSerializer?p=555154

*/

@XmlRoot("round")
public class Round{
	
	@XmlAttribute("id")
	public var id: int;
	
	public var name: String;
	public var round_id: int;
	public var next_round: String;
	public var intro_text: IntroText;
	public var questions: QuestionsContainer;
	
	//To load from an XML file giving its path
	public static function Load(path : String):Round {
 		var serializer : XmlSerializer = new XmlSerializer(Round);
 		var stream : Stream = new FileStream(path, FileMode.Open);
 		var result : Round = serializer.Deserialize(stream) as Round;
 		stream.Close();
 		return result;
 	}
 
	//Loads the xml directly from the given string. Useful in combination with www.text.
	//The webplayer can't access files on any computer directly so using the methods described before to read/write data won't work here. To load any data you need to use the WWW class.
	public static function LoadFromText(text : String):Round{
		var serializer : XmlSerializer = new XmlSerializer(Round);
		return serializer.Deserialize(new StringReader(text)) as Round;
	}
	
}

public class IntroText{
	
	@XmlArray("blind")				//The list is called blind in the xml
	@XmlArrayItem("statement")		//Each element is called Statement in the xml
	public var blind: List.<String> = new List.<String>();
	
	@XmlArray("normal")
	@XmlArrayItem("statement")
	public var normal:  List.<String> = new List.<String>();

}

public class QuestionsContainer{
	
	@XmlArray("questions")
	@XmlArrayItem("question")
	public var questions:  List.<question> = new List.<question>();
	
}

public class question{
	
	@XmlAttribute("name")
	public var id : int;
	
	public var type: int;
	public var score: int;
	public var value_: int;		//value is a reserved word
	public var text: String;
	
	@XmlArray("answers")
	@XmlArrayItem("answer")
	public var answers:  List.<Answers> = new List.<Answers>();
}

public class Answers{
	
	public var label: String;
	public var value_: int;
	
}