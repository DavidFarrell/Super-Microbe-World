import ebug.junior.Answer;
import ebug.junior.GameShowRound;
import ebug.junior.Question;


class ebug.junior.GameShowQuestionLoader {
	
	public var loading : Boolean = false;
	public var questionURL: String;
	private var xml : XML;
	var round : GameShowRound;
	private var interval : Number;
	
	public function GameShowQuestionLoader() {
		loading = false;
		xml = new XML();
		xml.ignoreWhite = true;
		questionURL = "";
	}
	
	public function loadRound(fileName : String) {
		questionURL = fileName;
		xml.load(fileName);
		loading = true;
		interval = setInterval(this,"checkXMLLoaded", 40);
		xml.onLoad = function(success:Boolean):Void {
		};
		
	}
	
	public function checkXMLLoaded() {
		var nLoaded : Number = xml.getBytesLoaded();
		var nTotal : Number = xml.getBytesTotal();
		var percentage : Number = 0;
		if ( nTotal > 0 ) {
			percentage = nLoaded / nTotal * 100;
		}
		if (percentage == 100) {
			clearInterval(interval);
			
			parseRound();
		} 
		//trace (percentage);
	}
	
	public function parseRound()  {
		/*
		 * 0 == name
		 * 1 == round id
		 * 2 == next round xml filename
		 * 2 == intro_text 
		 * 3 == questions
		 */
		round = new GameShowRound();
		var rootNote : XMLNode = xml.firstChild;
		round.name = rootNote.childNodes[0].firstChild.nodeValue;
		
		// round id
		round.roundId = rootNote.childNodes[1].firstChild.nodeValue;
		
		// next round
		round.nextRoundFile = rootNote.childNodes[2].firstChild.nodeValue;
		
		// intro text
		var textNode : XMLNode = rootNote.childNodes[3];
		round.introText = new Array();
		round.introText[GameShowRound.BLIND] = new Array();
		round.introText[GameShowRound.NOT_BLIND] = new Array();
		var blindText : XMLNode = textNode.childNodes[GameShowRound.BLIND];
		var notBlindText : XMLNode = textNode.childNodes[GameShowRound.NOT_BLIND];
		for (var i : Number = 0; i < blindText.childNodes.length; i++) {
			round.introText[GameShowRound.BLIND][i] = blindText.childNodes[i].firstChild.nodeValue;
		}
		for (var i : Number = 0; i < notBlindText.childNodes.length; i++) {
			round.introText[GameShowRound.NOT_BLIND][i] = notBlindText.childNodes[i].firstChild.nodeValue;
		}
		
		// questions
		var questionNode : XMLNode =  rootNote.childNodes[4];
		round.questions = new Array();
		for ( var i : Number = 0; i < questionNode.childNodes.length; i++) {
			var currentQNode : XMLNode = questionNode.childNodes[i];
			var question : Question = new Question();
			question.questionId = Number(currentQNode.attributes.id);
			question.questionType = Number(currentQNode.childNodes[0].firstChild.nodeValue);
			question.score = Number(currentQNode.childNodes[1].firstChild.nodeValue);
			question.value = Number(currentQNode.childNodes[2].firstChild.nodeValue);
			question.questionText = currentQNode.childNodes[3].firstChild.nodeValue;

			var answers: Array = new Array();
			var answerNode : XMLNode = currentQNode.childNodes[4];
			for (var j : Number = 0; j < answerNode.childNodes.length; j++) {
				var currentAnswer : Answer = new Answer();
				var currentAnswerNode : XMLNode = answerNode.childNodes[j];
				currentAnswer.label = currentAnswerNode.childNodes[0].firstChild.nodeValue;
				currentAnswer.value = Number(currentAnswerNode.childNodes[1].firstChild.nodeValue);
				answers.push(currentAnswer);
			}
			question.answers = answers;
			round.questions.push(question);
		}	
		loading = false;
	}
	
}