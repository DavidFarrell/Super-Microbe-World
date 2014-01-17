#pragma strict

public class LevelLogicQuiz extends MonoBehaviour{
	
	private var TextToText: String = '<?xml version="1.0" encoding="utf-8" ?><round id="0">	<name>All About Microbes</name>	<round_id>0</round_id>	<next_round>alpha_gameshow_round2.xml</next_round>	<intro_text>		<blind>			<statement>Welcome to the first BLIND QUESTION ROUND!</statement>			<statement>I"m going to ask you some questions but I"m NOT going to tell you if you got them right!</statement>			<statement>If you got them right, you"ll get a great bonus later though so try your best.</statement>			<statment>Lets go!</statment>		</blind>		<normal>			<statement>Well done, you"re a hoverboard natural!</statement>			<statement>Now it"s time to ask you those questions again</statement>			<statement>This time, you get 10 points for a correct answer, but if you get it wrong, the other player gets points.</statement>			<statement>so if you DON"T KNOW the answer, it"s best to play it safe and say so!</statement>			<statement>Ready?</statement>			<statement>Let"s go!</statement>		</normal>	</intro_text>	<questions>		<question id="0">			<type>0</type>			<score>10</score>			<value>1</value>			<text>If you cannot see a microbe it is not there</text>			<answers>				<answer>					<label>Agree</label>					<value>-1</value>				</answer>				<answer>					<lable>Don"t Know</lable>					<value>0</value>				</answer>				<answer>					<lable>Disagree</lable>					<value>1</value>				</answer>			</answers>		</question>		<question id="1">			<type>0</type>			<score>10</score>			<value>1</value>			<text>Bacteria and Viruses are the same</text>			<answers>				<answer>					<label>Agree</label>					<value>-1</value>				</answer>				<answer>					<label>Don"t Know</label>					<value>0</value>				</answer>				<answer>					<label>Disagree</label>					<value>1</value>				</answer>			</answers>		</question>		<question id="2">			<type>0</type>			<score>10</score>			<value>1</value>			<text>Fungi are microbes</text>			<answers>				<answer>					<label>Agree</label>					<value>1</value>				</answer>				<answer>					<label>Don"t Know</label>					<value>0</value>				</answer>				<answer>					<label>Disagree</label>					<value>-1</value>				</answer>			</answers>		</question>		<question id="3">			<type>0</type>			<score>10</score>			<value>1</value>			<text>Microbes are found on our hands</text>			<answers>				<answer>					<label>Agree</label>					<value>1</value>				</answer>				<answer>					<label>Don"t Know</label>					<value>0</value>				</answer>				<answer>					<label>Disagree</label>					<value>-1</value>				</answer>			</answers>		</question>	</questions></round>';
	
	private var Round1 : Round;
	
	function Awake () {
		
		Debug.Log("Starting to parse the xml...");
		
		Round1 = Round.LoadFromText(TextToText);
		
		Debug.Log("Parsed.");
		
	}
	
	function Start () {
		
		Debug.Log("Round id: " + Round.id);
		
	}

	function Update () {
		
		
		
	}
}//End of class brace