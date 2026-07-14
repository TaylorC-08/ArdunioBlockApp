// Original Raspberry Pi example programs, written for SketchBlocks and covered by the
// app's MIT license (not copied from any GPL/CC-BY-SA source). Each loads into the
// editor and is converted to blocks by the Python importer where possible.

export interface Example {
  name: string;
  description: string;
  code: string;
}

export interface ExampleCategory {
  name: string;
  examples: Example[];
}

const blink = `import RPi.GPIO as GPIO
import time

GPIO.setmode(GPIO.BCM)
GPIO.setup(17, GPIO.OUT)

try:
    while True:
        GPIO.output(17, GPIO.HIGH)
        time.sleep(1)
        GPIO.output(17, GPIO.LOW)
        time.sleep(1)
except KeyboardInterrupt:
    pass
finally:
    GPIO.cleanup()
`;

const buttonLed = `import RPi.GPIO as GPIO
import time

GPIO.setmode(GPIO.BCM)
GPIO.setup(17, GPIO.OUT)
GPIO.setup(2, GPIO.IN, pull_up_down=GPIO.PUD_UP)

try:
    while True:
        if GPIO.input(2) == 0:
            GPIO.output(17, GPIO.HIGH)
        else:
            GPIO.output(17, GPIO.LOW)
        time.sleep(0.05)
except KeyboardInterrupt:
    pass
finally:
    GPIO.cleanup()
`;

const trafficLight = `import RPi.GPIO as GPIO
import time

GPIO.setmode(GPIO.BCM)
GPIO.setup(17, GPIO.OUT)
GPIO.setup(27, GPIO.OUT)
GPIO.setup(22, GPIO.OUT)

try:
    while True:
        GPIO.output(17, GPIO.HIGH)
        time.sleep(3)
        GPIO.output(17, GPIO.LOW)
        GPIO.output(27, GPIO.HIGH)
        time.sleep(1)
        GPIO.output(27, GPIO.LOW)
        GPIO.output(22, GPIO.HIGH)
        time.sleep(3)
        GPIO.output(22, GPIO.LOW)
except KeyboardInterrupt:
    pass
finally:
    GPIO.cleanup()
`;

const buttonCounter = `import RPi.GPIO as GPIO
import time

GPIO.setmode(GPIO.BCM)
GPIO.setup(2, GPIO.IN, pull_up_down=GPIO.PUD_UP)
count = 0

try:
    while True:
        if GPIO.input(2) == 0:
            count += 1
            print(count)
            time.sleep(0.3)
        time.sleep(0.02)
except KeyboardInterrupt:
    pass
finally:
    GPIO.cleanup()
`;

const pwmFade = `import RPi.GPIO as GPIO
import time

GPIO.setmode(GPIO.BCM)
GPIO.setup(18, GPIO.OUT)
pwm_18 = GPIO.PWM(18, 1000)
pwm_18.start(0)

try:
    while True:
        for duty in range(0, 101, 5):
            pwm_18.ChangeDutyCycle(duty)
            time.sleep(0.03)
        for duty in range(100, -1, -5):
            pwm_18.ChangeDutyCycle(duty)
            time.sleep(0.03)
except KeyboardInterrupt:
    pass
finally:
    GPIO.cleanup()
`;

const servoSweep = `import RPi.GPIO as GPIO
import time

GPIO.setmode(GPIO.BCM)
GPIO.setup(18, GPIO.OUT)
pwm_18 = GPIO.PWM(18, 50)
pwm_18.start(0)

try:
    while True:
        for angle in range(0, 181, 10):
            pwm_18.ChangeDutyCycle(2 + angle / 18.0)
            time.sleep(0.1)
        for angle in range(180, -1, -10):
            pwm_18.ChangeDutyCycle(2 + angle / 18.0)
            time.sleep(0.1)
except KeyboardInterrupt:
    pass
finally:
    GPIO.cleanup()
`;

export const rpiExampleCategories: ExampleCategory[] = [
  {
    name: 'Basics',
    examples: [
      { name: 'Blink', description: 'Flash an LED on GPIO 17 once a second.', code: blink },
      { name: 'Button + LED', description: 'Light an LED while a button on GPIO 2 is pressed.', code: buttonLed },
      { name: 'Traffic Light', description: 'Cycle red / amber / green LEDs.', code: trafficLight },
      { name: 'Button Counter', description: 'Count button presses and print the total.', code: buttonCounter },
    ],
  },
  {
    name: 'Motion & Light',
    examples: [
      { name: 'PWM Fade', description: 'Smoothly fade an LED up and down with PWM on GPIO 18.', code: pwmFade },
      { name: 'Servo Sweep', description: 'Sweep a hobby servo back and forth on GPIO 18.', code: servoSweep },
    ],
  },
];
