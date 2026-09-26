import ebug.general.Talkie;
import ebug.junior.Answer;
import ebug.junior.GameShowQuestionLoader;
import ebug.junior.GameShowRound;
import ebug.junior.PlatformGame;
import ebug.junior.Question;
import ebug.junior.ShrinkingZone;
import ebug.Player;
import ebug.Constants;
import mx.data.types.Str;
/*
 * GameShow
 */

 class ebug.junior.GameShow extends MovieClip {
	public var board : MovieClip;
	public var studio : MovieClip;
	public var shrinkingZone : ShrinkingZone;
	 
	public var talkie : Talkie;
	
	public var roundIndex : Number;
	
	public var player : Player
	//public var score : Number;
	
	public var interval : Number;
	
	private var gameState : Number;
	var busy : Boolean;
	
	private var currentRound : GameShowRound;
	private var currentQuestion : Question;
	
	public var statementCounter : Number;
	
	public var level : Number;
	public var questionFile : String;
	private var questionLoader : GameShowQuestionLoader;
	
	private var playerAvatar : MovieClip;
	private var playerScoreBoard : MovieClip;
	public var cpu : Player
	private var cpuScoreBoard : MovieClip
	private var cpuAvatar : MovieClip;
	private var cpuName : String;
	//hack - should be in player
	var roundAnswersBlind : Array;
	var roundAnswersSighted : Array;
	
	function GameShow() {
		player = _root.getPlayer();
		player.forename = "Farrell";
		
		// get movies on stage
		board = attachMovie("question_board", "board", getNextHighestDepth());
		board._visible = false;

		studio = attachMovie("gameshow_set", "studio", getNextHighestDepth());
		//studio._visible = false;

		shrinkingZone = ShrinkingZone(attachMovie("shrinking_zone", "sz", getNextHighestDepth()));
		shrinkingZone._visible = false;

		talkie = Talkie(attachMovie("talkie", "talkie", getNextHighestDepth()));
		talkie._y = 308;
		talkie._x = 20;
		talkie._visible = false;
		
		
		// set up defaults
		//score = 0;
		cpu = new Player();
		cpu.score = 0;
		roundIndex = 0;
		
		//hack
		//player = new Player();
		//player.avatarSex = Player.FEMALE;
		
		// seems a bit hacky this line - but because this movie doesn't autoplay on load, the parent can't see the game object without this 
		//this._parent._parent.gameShow = this;
		_root.setGameShow(this);
		
		if ( player.avatarSex == Player.FEMALE ) {
			playerAvatar = studio.amy;
			playerScoreBoard = studio.podia.amy_score;
			//trace ("female..");
			shrinkingZone.setUserAvatar(Player.FEMALE);
			
			cpuAvatar = studio.harry;
			cpuScoreBoard = studio.podia.harry_score;
			cpuName = "Harry";
		} else {
			playerAvatar = studio.harry;
			playerScoreBoard = studio.podia.harry_score;
			
			//trace ("male..");
			shrinkingZone.setUserAvatar(Player.MALE);
			
			cpuAvatar = studio.amy;
			cpuScoreBoard = studio.podia.amy_score;
			cpuName = "Amy";
		}
		
		level = 0;
		player.playerAnswers[level] = new Array();
		player.playerAnswers[level][GameShowRound.BLIND] = new Array();
		player.playerAnswers[level][GameShowRound.NOT_BLIND] = new Array();
		
		questionFile = "../levels/alpha_gameshow_round1.xml";
		
		gameState = Constants.STATE_INIT;
		busy = false;
		
		
		init();
	}
	
	function init() {
		interval = setInterval(this, "main", 40);
	}
	
	function isZoneLoaded() { 
		if ( shrinkingZone.loadedHarry && shrinkingZone.loadedAmy ) {
			gameState = Constants.STATE_LOAD_LEVEL;
		}	
	}
	
	function loadLevel() {
		statementCounter = 0;
		questionLoader = new GameShowQuestionLoader();
		questionLoader.loadRound(questionFile);
		busy = false;
		roundAnswersBlind = new Array();
		roundAnswersSighted= new Array();
		gameState = Constants.STATE_LEVEL_LOADING;		
	}
	
	public function levelLoading() {
		if ( questionLoader.loading == false ) {
			currentRound = questionLoader.round;
			gameState = Constants.STATE_LEVEL_LOADED;
		}
	}
	
	function showRoundText() {
		if (currentRound.isBlind) {
			if (statementCounter < currentRound.introText[GameShowRound.BLIND].length) {
				talkie.init("Gameshow Host", currentRound.introText[GameShowRound.BLIND][statementCounter], "start", "wait_for_click", null, this, "nextRoundText");
				talkie._visible = true;
			} else {
				gameState = Constants.STATE_ASK_QUESTION;
				
			}
		} else {
			if (statementCounter < currentRound.introText[GameShowRound.NOT_BLIND].length) {
				talkie.init("Gameshow Host", currentRound.introText[GameShowRound.NOT_BLIND][statementCounter], "start", "wait_for_click", null, this, "nextRoundText");
				talkie._visible = true;
			} else {
				gameState = Constants.STATE_ASK_QUESTION;
			}
		} 
		busy = true;
					
	}
	
	function nextRoundText() {
		statementCounter ++;
		busy = false;
	}
	
	public function askQuestion() {
		busy = true;
		if (currentRound.questionIndex >= currentRound.questions.length) {
			nextRound();
		} else {
			currentQuestion = currentRound.questions[currentRound.questionIndex]
			talkie.init("Gameshow Host", "Question number " + (currentQuestion.questionId+1) + ": " + currentQuestion.questionText + "...", "start", "wait_for_click", null, this, "showBoard");
			gameState = Constants.STATE_ASK_QUESTION;
		}
	}
	
	public function showBoard() {
		board.question_heading.text = "Question " + (currentQuestion.questionId + 1);
		board.question_body.text = currentQuestion.questionText;
		board.point_value.text = currentQuestion.score + " Points";
		
		board.agree_button.value = 0;
		board.dont_know_button.value = 1;
		board.disagree_button.value = 2;
		
		board.agree_button["callbackObject"] = board.disagree_button["callbackObject"] = board.dont_know_button["callbackObject"] = this;
		board.agree_button["callbackMethod"] = board.disagree_button["callbackMethod"] = board.dont_know_button["callbackMethod"] = "receiveAnswer";
		
		board.agree_button.onRelease = board.disagree_button.onRelease = board.dont_know_button.onRelease = function() { 
			this["callbackObject"][this["callbackMethod"]](this["value"]);
		}
				
		talkie._visible = false;
		board._visible = true;
		studio._visible = false;
	}
	
	public function receiveAnswer(value : Number) {
		player = _root.getPlayer();
		var response : String = player.nickname + ", you chose ";
		if ( value == 0 ) {
			response += "Agree.";
		} else if (value == 1) {
			response += "Don't Know.";
		} else {
			response += "Disagree."
		}
		
		if (currentRound.isBlind) {
			response += "\nBecause this is a Blind question round, you'll find out how you did later.";
			studio.gsh.gotoAndPlay("serious");
			
			var randomChoice : Number = Math.floor(Math.random() * (2 - 0 + 1)) + 0;
			//trace ("RC: " + randomChoice);
			if (randomChoice == 0) {
				playerAvatar.upper.gotoAndPlay("neutral");
			} else if (randomChoice == 1) {
				playerAvatar.upper.gotoAndPlay("cautious");
			} else {
				playerAvatar.upper.gotoAndPlay("confident");
			}
			
			// store player results for research / bonus
			if ( currentQuestion.answers[value].value == Question.ANSWER_WRONG ) {
//				trace ("wrong");
				roundAnswersBlind[currentQuestion.questionId] = Question.ANSWER_WRONG;
				player.playerAnswers[currentRound.roundId][GameShowRound.BLIND][currentQuestion.questionId] = Question.ANSWER_WRONG;
			} else if (currentQuestion.answers[value].value == Question.ANSWER_DUNNO ) {
//				trace ("dunno");
				player.playerAnswers[currentRound.roundId][GameShowRound.BLIND][currentQuestion.questionId] = Question.ANSWER_DUNNO;
				roundAnswersBlind[currentQuestion.questionId] = Question.ANSWER_DUNNO;
			} else {
//				trace ("right");
				player.playerAnswers[currentRound.roundId][GameShowRound.BLIND][currentQuestion.questionId] = Question.ANSWER_CORRECT;
				roundAnswersBlind[currentQuestion.questionId] = Question.ANSWER_CORRECT;
			}
			
		} else {
			response += "\nThis is the...." ;
			if ( currentQuestion.answers[value].value == Question.ANSWER_WRONG) {
				studio.gsh.gotoAndPlay("disappointed");
				playerAvatar.upper.gotoAndPlay("disappointed");
				response += "WRONG answer!";
				
				changeScore(false, (Math.floor( currentQuestion.score / 2 )));
				
				roundAnswersSighted[currentQuestion.questionId] = Question.ANSWER_WRONG;
				player.playerAnswers[currentRound.roundId][GameShowRound.NOT_BLIND][currentQuestion.questionId] = Question.ANSWER_WRONG;
			} else if ( currentQuestion.answers[value].value == Question.ANSWER_DUNNO ) {
				studio.gsh.gotoAndPlay("serious");
				playerAvatar.upper.gotoAndPlay("neutral");
				response += "SAFE answer.";
				
				player.playerAnswers[currentRound.roundId][GameShowRound.NOT_BLIND][currentQuestion.questionId] = Question.ANSWER_DUNNO;
				
				roundAnswersSighted[currentQuestion.questionId] = Question.ANSWER_DUNNO;
			} else { 
				response += "CORRECT answer.";
				studio.gsh.gotoAndPlay("excited");
				playerAvatar.upper.gotoAndPlay("happy");
				
				player.playerAnswers[currentRound.roundId][GameShowRound.NOT_BLIND][currentQuestion.questionId] = Question.ANSWER_CORRECT;
				changeScore(true, currentQuestion.score);
				
				roundAnswersSighted[currentQuestion.questionId] = Question.ANSWER_CORRECT;
			}
		}
		
		
		// if finished the last question in this round, then move onto next stage, else onward to next question
		currentRound.questionIndex++;
		if ( currentRound.questionIndex < currentRound.questions.length ) {
			talkie.init("Gameshow Host", response, "start", "wait_for_click", null, this, "pickCpuResponse");
			studio._visible = true;
			board._visible = false;
			talkie._visible = true;
		} else {
			// finished round - if was blind, then do some jumping - else summarise and next level.
			// assume blind for time being
			if ( currentRound.isBlind ) { 
				//trace (" this is the end of the blind round");
				talkie.init("Gameshow Host", "Step right this way and prepare to enter the world of microbes!", "start", "wait_for_click", null, this, "showShrinkingZone");
				studio._visible = true;
				board._visible = false;
				talkie._visible = true;
			} else { 
				// not blind, so next round unless FINAL round (todo)
				if ( true ) { // this would exit if last round
					nextRound();	
				}
				
			}
		}
	}
	
	// randomly pick a CPU Response to the question
	function pickCpuResponse() {
		player = _root.getPlayer();
		if (! currentRound.isBlind ) {
			var response : String = cpuName + ", you chose the ";
			var randomChoice : Number = Math.floor(Math.random() * (2 - 0 + 1)) + 0;
			var cpuCorrect : Number = currentQuestion.answers[randomChoice].value ;
			var userCorrect : Number = player.playerAnswers[currentRound.roundId][GameShowRound.NOT_BLIND][(currentQuestion.questionId)] ;
			
			if ( cpuCorrect == Question.ANSWER_WRONG) {
				cpuAvatar.upper.gotoAndPlay("disappointed");
				response += "WRONG answer!";	
				changeScore(true, (Math.floor( currentQuestion.score / 2 ) ) );
			} else if ( cpuCorrect == Question.ANSWER_DUNNO ) {
				cpuAvatar.upper.gotoAndPlay("neutral");
				response += "SAFE answer.";
			} else { 
				response += "CORRECT answer.";
				cpuAvatar.upper.gotoAndPlay("happy");	
				changeScore(false, currentQuestion.score);
			}
			
			talkie.init("Gameshow Host", response, "start", "wait_for_click", null, this, "askQuestion");
		} else {
			askQuestion();
		}
	}
	
	function changeScore(isPlayer : Boolean, change : Number) {
		//trace ("give " + isPlayer + " " + change + " points");
		player = _root.getPlayer();
		if (isPlayer) {
			player.score += change;
			updateScoreBoard(playerScoreBoard, player.score);
		} else {
			cpu.score += change;
			updateScoreBoard(cpuScoreBoard, cpu.score);
		}
		
		
	}
	
	function translateNumbersToWords(number : Number) : String {
		var result : String = "zero";
		
		if (number == 1) {
			result = "one";	
		} else if (number == 2) {
			result = "two";	
		} else if (number == 3) {
			result = "three";	
		} else if (number == 4) {
			result = "four";	
		} else if (number == 5) {
			result = "five";	
		} else if (number == 6) {
			result = "six";	
		} else if (number == 7) {
			result = "seven";	
		} else if (number == 8) {
			result = "eight";	
		} else if (number == 9) {
			result = "nine";	
		}
		
		return result;	
	}
	
	function updateScoreBoard(clip : MovieClip, score : Number ) : Boolean {
		var tempscore : Number = score;
		var thousands : Number = Math.floor(tempscore / 1000);		
		tempscore -= (thousands * 1000);
		var hundreds : Number = Math.floor(tempscore / 100);		
		tempscore -= (hundreds * 100);
		var tens : Number = Math.floor(tempscore / 10);		
		tempscore -= (tens * 10);
		var units = Math.floor(tempscore);
		
		clip.units.gotoAndStop(translateNumbersToWords(units));
		clip.tens.gotoAndStop(translateNumbersToWords(tens));
		clip.hundreds.gotoAndStop(translateNumbersToWords(hundreds));
		clip.thousands.gotoAndStop(translateNumbersToWords(thousands));
		return true;
	}
	
	function showShrinkingZone() {
		player = _root.getPlayer();
		//trace ("player: " + player.nickname + " sex male? " + (player.avatarSex == Player.MALE)  );
		// assume harry
		if (player.avatarSex == Player.MALE) {
			shrinkingZone.harry._visible = true;
			shrinkingZone._visible = true;
			shrinkingZone.harry.avatar.play();
		} else {
			shrinkingZone.amy._visible = true;
			shrinkingZone._visible = true;
			shrinkingZone.amy.avatar.play();
		}
		studio._visible = false;
		talkie._visible = false;
		//trace ("user avatar alpha A" + shrinkingZone.amy.avatar._alpha);
		//trace ("user avatar alpha H" + shrinkingZone.harry.avatar._alpha);
		shrinkingZone.harry.avatar._alpha = 100;
		// stop 'main' being called all the time 
		clearInterval(interval);
		// wait for shrinking to conclude
		interval = setInterval(shrinkingZone, "isFinishedAnimation", 40);
		
		gameState = Constants.STATE_ROUND_OVER
	}
	/*
	function showHoverboard() {
		clearInterval(interval);
		
		trace("show hb - goign to root nhr");
		_root.nextHoverboardRound() ;
	}*/
	
	function startNonBlindRound() {
		currentRound.isBlind = false;
		
		//roundIndex ++;
		//questionFile = "../levels/" + currentRound.nextRoundFile;
		
		talkie._visible = false;
		board._visible = false;
		studio._visible = true;
		shrinkingZone._visible = false;
		currentRound.questionIndex = 0;
		statementCounter = 0;
		
		gameState = Constants.STATE_ROUND_TEXT;
		busy = false;
		//trace("non blind round");
		// we return here after hoverboard, so call init to start up the loop again
		init();
	}
	
	/*
	 * nextRound is called after we conclude the sighted quiz part of the round. 
	 * load new q's then kick off the blind component
	 */
	function nextRound() {
		trace ("send answers for round"  + currentRound.roundId +" have: " + roundAnswersBlind.length + " and " + roundAnswersSighted.length);
		_root.submitPlayerData(currentRound.roundId, roundAnswersBlind, roundAnswersSighted);
		player = _root.getPlayer();
		
		
		if ( currentRound.nextRoundFile == "exit") {
			if ( player.score > cpu.score ) {
				talkie.init("Gameshow Host", "Well done! You beat " + cpu.nickname+ ".  Thank you for playing.  To play again, reload this web page.", "start", "wait_for_click", null, this, "exit");
			} else {
				talkie.init("Gameshow Host", "At the end of the game, I'm sorry to say you lost.  Thank you for playing.  To play again, reload this web page.", "start", "wait_for_click", null, this, "exit");
			}
			studio._visible = true;
			board._visible = false;
			talkie._visible = true;
		} else {
			roundIndex ++;
			statementCounter = 0;
				
			//trace ("loading questions: " + 			 "../levels/" + currentRound.nextRoundFile);

			questionFile = "../levels/" + currentRound.nextRoundFile;
			
			talkie._visible = false;
			board._visible = false;
			studio._visible = true;
			shrinkingZone._visible = false;
			
			gameState = Constants.STATE_LOAD_LEVEL;
			busy = false;
		}
	}
	
	function exit() {
		trace ("exit");
		_root.exit();
	}
	
	function main() {
		//trace ("main - state: " + gameState + " busy: " + busy);
		if ( !busy ) {
			switch (gameState) {
				case Constants.STATE_INIT:
						isZoneLoaded();
					break;
				case Constants.STATE_LOAD_LEVEL:
					busy = true;
					loadLevel();
					break;
				case Constants.STATE_LEVEL_LOADING:
					levelLoading();
					break;
				case Constants.STATE_LEVEL_LOADED:
					currentRound = questionLoader.round;
					//trace ("current round defined - ound is: " + currentRound.nextRoundFile + " - " + currentRound.isBlind);
					gameState = Constants.STATE_ROUND_TEXT
					break;
				case Constants.STATE_ROUND_TEXT:
					showRoundText();
					break;
				case Constants.STATE_ASK_QUESTION:
					askQuestion();
					break;
				case Constants.STATE_ROUND_OVER:
					;//wait for control;
					break;
			}
		}
	}
 }