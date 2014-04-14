#pragma strict

//This script will draw yoghurt overflowing on top of the yoghurt glass and trigger the animation when there's some lucy bacteria being dropped in

public var topping_left: GameObject;
public var topping_mid: GameObject;
public var topping_right: GameObject;

private var topLeftRenderer: SpriteRenderer;
private var topMidRenderer: SpriteRenderer;
private var topRightRenderer: SpriteRenderer;

private var milkAnimator: Animator;

private var toppingActive: boolean = false;

function Start () {
	topLeftRenderer = topping_left.GetComponent(SpriteRenderer);
	topMidRenderer = topping_mid.GetComponent(SpriteRenderer);
	topRightRenderer = topping_right.GetComponent(SpriteRenderer);
	milkAnimator = transform.GetComponent(Animator);
//	if (topLeftRenderer == null) Debug.LogError("Renderer not found");
//	else Debug.Log("Renderer found correctly");
}

function Update () {

}

function DrawYoghurt(delay: int){
	if(!toppingActive){
		toppingActive = false;
		yield new WaitForSeconds(delay);		//Waits the time that the bacteria takes to jump into the yoghurt
		milkAnimator.SetTrigger("turn");
	}
}