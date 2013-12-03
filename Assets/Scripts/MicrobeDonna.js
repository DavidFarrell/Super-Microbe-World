#pragma strict

//imports
import iTween;

public class MicrobeDonna extends MonoBehaviour{
	
	/*Debug vars*/
	private var debugMode: boolean = false;				//When true, this script displays all the Debug messages.
	private var timer: float = 0;
	
	/*Regular Vars*/
	public var Speed: float = 1;			//the max speed
	public var facingRight: boolean = true;		//if the bug will face (and walk) right at first. Note that in the preview it will always face right independently of this value.
	public var moveDistance: int = 50;			//Maximum amount of movement that the bug will perform right and left. If there is not more ground or there is a wall it will turn itself.
	public var timeWaiting: float = 3;			//Time in seconds that the bug will be waiting before turning around
	
	private var anim: Animator;
	private var isWalking: boolean = false;
	private var isWaiting: boolean = false;
	private var direction: Vector2 = facingRight ? Vector2.right : Vector2.right * (-1);

	private var myTransform: Transform;			//To keep the transform of the microbe
	private var myGameObject: GameObject;
	private var myRigidbody2D: Rigidbody2D;

	//To keep the number of the layers
	private var groundLayer: int = 12;
	private var playerLayer: int = 9;
	private var nonEnemiesLayer: int = 13;
	private var enemiesLayer: int = 10;

	//We'll use the LayerMask to detect just the collisions with the ground objects when deciding where to walk. More info about layerMasks here: http://answers.unity3d.com/questions/8715/how-do-i-use-layermasks.html
	private var groundLayerMask: int = 1 << groundLayer;	//The number of layer for the ground is 12: so the mask will be 0000 0000 0000 0000 0001 0000 0000 0000

	private var groundPoint: Vector2;			//will contain a point which is placed just in front of lucy under the ground to check if It will be possible to continue walking in this platform
	private var groundHits: Collider2D[];
	private var groundHitsNumber: int;
	
	function Awake () {
	
		anim = gameObject.GetComponent(Animator);	//To store the animator

		if (moveDistance < 0) moveDistance *= -1;	//To assure that moveDistance is always positive when beginning this script
		if (!facingRight){
			facingRight = true;						//Flip() will change the value of facingRight to false and the sign of moveDistance to negative. That's why I'm doing this.
			direction = facingRight ? Vector2.right : Vector2.right * (-1);
			Flip();
		}
		
		iTween.Init(gameObject);		//Initializing iTween in order to avoid hiccups when first playing the movements
		myTransform = transform;
		myGameObject = gameObject;
		myRigidbody2D = myTransform.rigidbody2D;
		
		groundHits = new Collider2D[5];
		
	}
	
	function Start () {
		
		isWalking = false;
		isWaiting = false;
		walk();

	
	}

	function Update () {
	
	showMessages();
	
	//Debug.DrawLine(Vector2(groundPoint.x-0.1, groundPoint.y-0.1), Vector2(groundPoint.x+0.1, groundPoint.y+0.1), Color.blue, 0);	//Shows the point of the groundCheck
	//Debug.DrawLine(Vector2(groundPoint.x+0.1, groundPoint.y+0.1), Vector2(groundPoint.x-0.1, groundPoint.y-0.1), Color.red, 0);
	
	}
	
	function FixedUpdate () {
		
		
		
		if(!isWaiting){
			if (!isWalking){	//Not waiting nor walking
				walk();
			}
			else{		//Not waiting and walking
				
				// Calculate the number of objects in the layer Ground that overlap with the given point ( local point (+-0.16, -1.2) placed under the ground, in front of the player) to turn around if it's 0
				//because this means that there is no ground where to continue walking.
				groundPoint = Vector2(myTransform.position.x + (0.61 * direction.x), myTransform.position.y - 0.88);	
				
				groundHitsNumber = Physics2D.OverlapPointNonAlloc(groundPoint, groundHits, groundLayerMask);
				
				if (debugMode) Debug.DrawRay(groundPoint, 0.2 * direction, Color.green, 2);
				//Debug.Log("groundHitsNumber: " + groundHitsNumber);
				if (groundHitsNumber == 0){
					if (debugMode) Debug.Log("Pos: " + groundPoint + " No floor ahead. Turning around...");		
					//Debug.Log("Hit: " + groundHits[0]);
					StopThenFlip();
				}
				
			}
		}
	
	}
	
	function OnTriggerEnter2D(collisionInfo : Collider2D){
		//Debug.Log("Trigger enter at layer:" + collisionInfo.gameObject.layer);
		if(!isWaiting && (	collisionInfo.gameObject.layer == groundLayer 
							|| collisionInfo.gameObject.layer == playerLayer
							|| collisionInfo.gameObject.layer == nonEnemiesLayer
							|| collisionInfo.gameObject.layer == enemiesLayer)){		//If not waiting and the collision occurred against something in the ground (12th) or player(9th) layer or NonEnemies or Enemies layers...
			//Debug.Log("Trigger enter. Turning around...");
			StopThenFlip();																						//Turn around
		}
	}	
	
	/*	Makes the character begin walking, playing the walk annimation
	*
	*/
	function walk (){
		isWalking = true;
		anim.SetFloat("speed", 1.0); 					//To play the "idle" animation
		iTween.MoveAdd(myGameObject, {"x": moveDistance, "speed": Speed, "easetype": EaseType.linear, "oncomplete": "Flip"});
		Debug.Log("Donna.- Walking...");
	}

	/*Stops all the animations of this gameObject playing the idle animation for "timeWaiting" seconds. When finished waiting it Flips the character.
	*
	*/
	function StopThenFlip () : IEnumerator{
		
		Debug.Log("Donna.- Stop.");
		
		isWaiting = true;
		
		isWalking = false;
		iTween.Stop(gameObject);						//Stops all the iTweens of this gameObject
		anim.SetFloat("speed", 0.0); 					//To play the "idle" animation
		yield new WaitForSeconds(timeWaiting);
		Flip();
		
		isWaiting = false;
		
	}

	/**
	* Flips the texture in the Y axis. Useful to flip the characters when they reach an obstacle.
	*
	*/
	function Flip () {
		
		Debug.Log("Donna.- Stop.");
		
		facingRight = !facingRight;						
		direction = facingRight ? Vector2.right : Vector2.right * (-1);
		moveDistance *= -1;								//Change the direction of the movement
		
		var pos: Vector3 = transform.position;			//It's neccesary to move a little bit the bug because the animation is not centered in the sprite
		if(!facingRight) pos.x -= 0.5;
		else pos.x += 0.5;
		transform.position = pos;
		var bugScale: Vector3 = transform.localScale;
		bugScale.x *= -1;
		transform.localScale = bugScale;

	}
	
	function bePhotographed(){
	
		anim.SetTrigger("be_photographed");
	
	};
	
	public function beWashedAway() : IEnumerator{
	
		anim.SetTrigger("be_washed_away");
		
		myRigidbody2D.gravityScale = 0.05;
		
		for(var i: int = 0; i < 20; i++){
			myRigidbody2D.AddForce(Vector2(0, 10));
			yield new WaitForSeconds(0.05);
		}
		
		Destroy(gameObject);
	
	};
	
	function beKilled(){
	
		anim.SetTrigger("be_killed");
	
	};
	
	function beHit(){
	
		anim.SetTrigger("be_hit");
	
	};
	
	function beFrozen(){
	
		anim.SetTrigger("be_frozen");
	
	};
	
	//This function triggers the debugMode to true during 1 frame each second. It is intended to show one frame per second the Debug messages. Use this way:
	//if (debugMode) Debug.log("Your message");
	private function showMessages(){
		timer += Time.deltaTime;
		debugMode = false;
		if (timer > 1){
			debugMode = true;
			timer = 0;
		}	
	}
	
}